<script setup lang="ts">
import { ref, computed, onUnmounted, watch, onMounted } from 'vue';
import { getSessionDetails, getOrderPrice, createOrder, getSessions, checkOrderStatus, checkPromoCode, getPromotions } from '../services/api';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        openInvoice?: (url: string, callback: (status: string) => void) => void;
        version?: string;
        platform?: string;
        isExpanded?: boolean;
        expand?: () => void;
        ready?: () => void;
      };
    };
  }
}

interface Session {
  id: number;
  date: string;
}

interface SessionTime {
  id: number;
  start_time: string;
  end_time: string;
  available_places_count: number;
  available_penguin_count: number;
}

interface SessionDetails {
  id: number;
  date: string;
  times: SessionTime[];
}
interface Promotion {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  sum: number;
  image: string | null;
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
}
type FilterType = '' | 'nearest' | 'weekend' | 'custom';
function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'response' in error;
}

const isTelegram = ref(false);
const tgWebApp = ref<any>(null);
const initData = ref<string>('');
const isTelegramReady = ref(false);

const paymentStatus = ref({
  loading: false,
  success: null as boolean | null,
  order: null as any
});

const sessions = ref<Session[]>([]);
const filterType = ref<FilterType>('');
const customDate = ref('');
const sessionId = ref<number | null>(null);
const selectedTimes = ref<SessionTime[]>([]);
const selectedTimeId = ref<number | null>(null);
const sessionDetails = ref<SessionDetails | null>(null);
const adults = ref(1);
const children = ref(0);
const needPenguins = ref(false);
const penguinsCount = ref(0);
const needSkates = ref(false);
const skatesCount = ref(0);
const userName = ref('');
const phoneNumber = ref('');
const phoneError = ref('');
const promoCode = ref('');
const promoCodeInput = ref('');
const promoCodeError = ref('');
const promoCodeApplied = ref(false);
const promoCodeDetails = ref<{
  sum: number;
  percentage_check: string;
} | null>(null);
const totalCost = ref(0);
const originalCost = ref(0); // Базовая стоимость без скидок
const isReviewMode = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const agreement = ref(false);
const privacyPolicy = ref(false);
const nameError = ref('');
const checkboxError = ref('');
const paymentWindow = ref<Window | null>(null);
const checkStatusInterval = ref<number | null>(null);
const promotions = ref<Promotion[]>([]);
const selectedPromotions = ref<number[]>([]);
const showPromotionModal = ref(false);
const currentPromotion = ref<Promotion | null>(null);

const checkTelegramWebApp = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      window.Telegram?.WebApp?.initData !== undefined &&
      window.Telegram?.WebApp?.platform !== 'unknown'
    );
  } catch (e) {
    return false;
  }
};


const initTelegramWebApp = async () => {
  if (!checkTelegramWebApp()) {
    console.log('Telegram WebApp недоступен');
    return;
  }

  try {
    tgWebApp.value = window.Telegram?.WebApp;
    
    if (tgWebApp.value) {
      // Сообщаем Telegram, что приложение готово
      tgWebApp.value.ready?.();
      isTelegramReady.value = true;
      
      // Разворачиваем приложение на весь экран
      if (!tgWebApp.value.isExpanded) {
        tgWebApp.value.expand?.();
      }
      
      // Получаем initData
      initData.value = tgWebApp.value.initData || '';
      console.log('InitData получен:', initData.value ? 'Да' : 'Нет');
      
      // // Настройка главной кнопки
      // setupMainButton();
      
      // // Настройка кнопки "Назад"
      // setupBackButton();
      
      // // Включение тактильной обратной связи
      // enableHapticFeedback();
      
      console.log('Telegram WebApp успешно инициализирован');
    }
  } catch (error) {
    console.error('Ошибка инициализации Telegram WebApp:', error);
  }
};

onMounted(async () => {
  isTelegram.value = checkTelegramWebApp();
  console.log('isTelegram:', isTelegram.value);
  
  if (isTelegram.value) {
    await initTelegramWebApp();
  }
});


const showPenguinsNeeds = computed(() => children.value > 0);
const showPenguinsInput = computed(() => needPenguins.value);
const showSkatesInput = computed(() => needSkates.value);
const showDatePicker = computed(() => filterType.value === 'custom');
const selectedTime = computed(() => {
  return selectedTimes.value.find(time => time.id === selectedTimeId.value) || null;
});

const validateName = (name: string): boolean => {
  if (!name.trim()) {
    nameError.value = 'Поле обязательно для заполнения';
    return false;
  }
  if (name.trim().length < 2) {
    nameError.value = 'Имя должно содержать минимум 2 символа';
    return false;
  }
  if (/\d/.test(name)) {
    nameError.value = 'Имя не должно содержать цифры';
    return false;
  }
  nameError.value = '';
  return true;
};

const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 11 && (cleaned[0] === '7' || cleaned[0] === '8');
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

const formatPhoneNumber = (value: string): string => {
  let cleaned = value.replace(/\D/g, '');
  if (cleaned.length > 0 && !['7', '8'].includes(cleaned[0])) {
    cleaned = '7' + cleaned;
  }
  cleaned = cleaned.substring(0, 11);

  const match = cleaned.match(/^(\d)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!match) return '';

  return `+${match[1]}${match[2] ? ` (${match[2]}` : ''}${match[3] ? `) ${match[3]}` : ''}${match[4] ? `-${match[4]}` : ''}${match[5] ? `-${match[5]}` : ''}`;
};

const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  let value = input.value.replace(/\D/g, '');
  if (value.length > 0) {
    const firstDigit = value[0] === '8' ? '8' : '7';
    value = firstDigit + value.substring(1, 11);
  }
  phoneNumber.value = value;
  input.value = formatPhoneNumber(value);
};

const handlePhoneBlur = () => {
  if (!phoneNumber.value) {
    phoneError.value = 'Поле обязательно для заполнения';
    return;
  }
  phoneError.value = validatePhone(phoneNumber.value) ? '' : 'Введите корректный номер телефона (начинается с 7 или 8)';
};

const normalizePhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');

  // Если номер начинается с 7, заменяем на 8
  if (cleaned.length > 0 && cleaned[0] === '7') {
    cleaned = '8' + cleaned.substring(1);
  }

  return cleaned.substring(0, 11);
};

async function loadSessions() {
  if (!filterType.value || (filterType.value === 'custom' && !customDate.value)) {
    errorMessage.value = filterType.value === 'custom' ? 'Пожалуйста, выберите дату' : '';
    sessions.value = [];
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    sessions.value = await getSessions(filterType.value, customDate.value);
    await fetchPromotions();
  } catch (error) {
    console.error('Ошибка загрузки сеансов:', error);
    errorMessage.value = 'Не удалось загрузить сеансы. Попробуйте позже.';
    sessions.value = [];
  } finally {
    isLoading.value = false;
  }
}

const getDateTimes = async (session: Session) => {
  sessionId.value = session.id;
  try {
    const details = await getSessionDetails(session.id);
    sessionDetails.value = details;
    selectedTimes.value = details.times;
    selectedTimeId.value = isTelegram.value ? null : details.times[0]?.id || null;
  } catch (error) {
    console.error('Ошибка загрузки времени сеансов:', error);
    errorMessage.value = 'Не удалось загрузить доступное время';
    selectedTimes.value = [];
  }
};

const fetchPromotions = async () => {
  try {
    promotions.value = await getPromotions();
  } catch (error) {
    console.error('Ошибка загрузки акций:', error);
  }
};

const openPromotionModal = (promotion: Promotion) => {
  currentPromotion.value = promotion;
  showPromotionModal.value = true;
};

const isPromotionActive = (promotion: Promotion) => {
  if (!sessionDetails.value?.date) return false;

  const sessionDate = new Date(sessionDetails.value.date);
  const startDate = new Date(promotion.start_date.split('.').reverse().join('-'));
  const endDate = new Date(promotion.end_date.split('.').reverse().join('-'));

  return sessionDate >= startDate && sessionDate <= endDate;
};

const isPromotionAdded = (promotionId: number) => {
  return selectedPromotions.value.includes(promotionId);
};

// Универсальная функция для расчета стоимости
const calculatePrice = async () => {
  if (!sessionId.value || !selectedTimeId.value) return;

  try {
    const payload = {
      session: sessionId.value,
      session_time: selectedTimeId.value,
      adult_count: adults.value,
      child_count: children.value,
      penguin_count: penguinsCount.value,
      skates_count: skatesCount.value,
      user_name: userName.value,
      user_phone: phoneNumber.value,
      promo_code: promoCodeApplied.value ? promoCode.value : null,
      promotions: selectedPromotions.value,
      ...(isTelegram.value && { InitData: initData.value })
    };

    const priceResult = await getOrderPrice(payload);
    totalCost.value = priceResult.price;

    // Если нет скидок, то это базовая стоимость
    if (!promoCodeApplied.value && selectedPromotions.value.length === 0) {
      originalCost.value = priceResult.price;
    }
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
  }
};

const togglePromotion = async (promotionId: number) => {
  const index = selectedPromotions.value.indexOf(promotionId);
  if (index > -1) {
    selectedPromotions.value.splice(index, 1);
  } else {
    selectedPromotions.value.push(promotionId);
  }

  showPromotionModal.value = false;

  // Пересчитываем стоимость после изменения акций
  if (sessionId.value && selectedTimeId.value) {
    await calculatePrice();
  }
};

const applyPromoCode = async () => {
  promoCodeError.value = '';

  if (!sessionId.value || !selectedTimeId.value) {
    promoCodeError.value = 'Сначала выберите дату и время сеанса';
    return;
  }

  try {
    if (promoCodeApplied.value) {
      // Сбрасываем промокод
      promoCodeInput.value = '';
      promoCode.value = '';
      promoCodeApplied.value = false;
      promoCodeDetails.value = null;
    } else {
      // Применяем промокод
      if (!promoCodeInput.value.trim()) {
        promoCodeError.value = 'Введите промокод';
        return;
      }

      // Проверяем валидность промокода
      try {
        const promoResponse = await checkPromoCode(promoCodeInput.value);
        promoCodeDetails.value = {
          sum: promoResponse.sum,
          percentage_check: promoResponse.percentage_check
        };
        promoCodeApplied.value = true;
        promoCode.value = promoCodeInput.value;
      } catch (error) {
        if (isApiError(error)) {
          promoCodeError.value = error.response?.status === 404
            ? 'Промокод недействителен или уже был использован'
            : error.response?.data?.message || 'Ошибка при проверке промокода';
        } else if (error instanceof Error) {
          promoCodeError.value = error.message;
        } else {
          promoCodeError.value = 'Неизвестная ошибка при проверке промокода';
        }
        return;
      }
    }

    // Пересчитываем стоимость после изменения промокода
    await calculatePrice();

  } catch (error) {
    console.error('Ошибка:', error);
    promoCodeError.value = 'Ошибка при обработке промокода';
  }
};

const handleSubmit = async (event: Event) => {
  event.preventDefault();
  checkboxError.value = '';
  errorMessage.value = '';

  if (!sessionId.value || (isTelegram.value && !selectedTimeId.value)) {
    errorMessage.value = 'Пожалуйста, выберите дату и время';
    return;
  }

  if (!validateName(userName.value)) {
    return;
  }

  if (!validatePhone(phoneNumber.value)) {
    phoneError.value = 'Введите корректный номер телефона (начинается с 7 или 8)';
    return;
  }

  if (!agreement.value || !privacyPolicy.value) {
    checkboxError.value = 'Необходимо принять условия соглашения и политики конфиденциальности';
    return;
  }

  try {
    // Получаем базовую стоимость без скидок для отображения в превью
    const basePricePayload = {
      session: sessionId.value,
      session_time: selectedTimeId.value,
      adult_count: adults.value,
      child_count: children.value,
      penguin_count: penguinsCount.value,
      skates_count: skatesCount.value,
      user_name: userName.value,
      user_phone: normalizePhoneNumber(phoneNumber.value),
      promo_code: null,
      promotions: []
    };

    const basePriceResult = await getOrderPrice(basePricePayload);
    originalCost.value = basePriceResult.price;

    // Если есть применённые скидки, пересчитываем с ними
    if (promoCodeApplied.value || selectedPromotions.value.length > 0) {
      await calculatePrice();
    } else {
      totalCost.value = originalCost.value;
    }

    isReviewMode.value = true;
    paymentStatus.value = { loading: false, success: null, order: null };
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
    errorMessage.value = 'Ошибка при расчете стоимости';
  }
};

const completeOrder = async () => {
  if (!sessionId.value || !selectedTimeId.value) return;

  try {
    paymentStatus.value = { loading: true, success: null, order: null };

    const payload: Record<string, any> = {
      session: sessionId.value,
      adult_count: adults.value,
      child_count: children.value,
      penguin_count: penguinsCount.value,
      skates_count: skatesCount.value,
      time: selectedTimeId.value,
      user_name: userName.value,
      user_phone: normalizePhoneNumber(phoneNumber.value),
      promo_code: promoCodeApplied.value ? promoCode.value : null,
      promotions: selectedPromotions.value.length > 0 ? selectedPromotions.value : [],
      ...(isTelegram.value && initData.value && { InitData: initData.value })
    };

    console.log('Отправляемые данные:', payload);
    const response = await createOrder(payload);
    let paymentUrl = response.payment_url;

    if (isTelegram.value) {
      paymentUrl = paymentUrl.replace(
        'https://yoomoney.ru/checkout/payments/v2/contract',
        'https://telegram-payments.yoomoney.ru'
      );
    }

    if (isTelegram.value && window.Telegram?.WebApp?.openInvoice) {
      window.Telegram.WebApp.openInvoice(paymentUrl, (status: string) => {
        if (status === 'success') {
          paymentStatus.value = { loading: false, success: true, order: response };
        } else {
          paymentStatus.value = { loading: false, success: false, order: null };
          errorMessage.value = 'Ошибка при оплате заказа';
        }
      });
    } else {
      paymentWindow.value = window.open(response.payment_url, '_blank');
      startPaymentStatusCheck(response.uuid);
    }
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    paymentStatus.value = { loading: false, success: false, order: null };
    errorMessage.value = 'Ошибка при создании заказа';
  }
};
const startPaymentStatusCheck = (uuid: string) => {
  checkStatusInterval.value = window.setInterval(async () => {
    try {
      const status = await checkOrderStatus(uuid);
      if (status.success) {
        clearInterval(checkStatusInterval.value!);
        paymentStatus.value = { loading: false, success: true, order: status.order };
        paymentWindow.value?.close();
      }
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
      clearInterval(checkStatusInterval.value!);
      paymentStatus.value = { loading: false, success: false, order: null };
    }
  }, 5000);
};

const resetPaymentStatus = () => {
  paymentStatus.value = { loading: false, success: null, order: null };
};

const cancelReview = () => {
  isReviewMode.value = false;
  resetPaymentStatus();
  promoCodeApplied.value = false;
  promoCodeInput.value = '';
  promoCode.value = '';
  promoCodeDetails.value = null;
  selectedPromotions.value = [];
};

onUnmounted(() => {
  if (checkStatusInterval.value) {
    clearInterval(checkStatusInterval.value);
  }
  paymentWindow.value?.close();
});

watch(filterType, (newVal) => {
  sessions.value = [];
  sessionId.value = null;
  selectedTimes.value = [];
  selectedTimeId.value = null;
  if (newVal && newVal !== 'custom') loadSessions();
});

watch(customDate, (newVal) => {
  if (filterType.value === 'custom' && newVal) loadSessions();
});

// Добавляем наблюдатели для автоматического пересчета стоимости
watch([adults, children, penguinsCount, skatesCount], () => {
  if (sessionId.value && selectedTimeId.value) {
    calculatePrice();
  }
});

watch(selectedTimeId, (newVal) => {
  if (newVal && sessionId.value) {
    calculatePrice();
  }
});
</script>

<template>
  <div class="booking-container" :class="{ 'telegram': isTelegram }">
    <!-- Блок фильтрации сеансов -->
    <div class="filter-container" v-if="!isReviewMode">
      <select v-model="filterType" class="filter-select">
        <option value="" disabled selected>Выберите дату и время сеанса</option>
        <option value="nearest">Ближайшие три дня</option>
        <option value="weekend">Ближайшие выходные</option>
        <option value="custom">Определённая дата</option>
      </select>

      <div v-if="showDatePicker" class="date-picker">
        <label>Выберите дату:</label>
        <input type="date" v-model="customDate" :min="new Date().toISOString().split('T')[0]" :disabled="isLoading" />
      </div>

      <div v-if="isLoading" class="loading-message">Загрузка сеансов...</div>
      <div v-else-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <template v-else>
        <ul v-if="sessions.length > 0" class="session-list">
          <li v-for="session in sessions" :key="session.id" @click="getDateTimes(session)" class="session-item"
            :class="{ 'selected': sessionId === session.id }">
            {{ formatDate(session.date) }}

            <ul v-if="sessionId === session.id && selectedTimes.length" class="time-list"
              :class="{ 'interactive': isTelegram }">
              <li v-for="time in selectedTimes" :key="time.id" @click.stop="isTelegram && (selectedTimeId = time.id)"
                class="time-item" :class="{
                  'selected-time': isTelegram && (selectedTimeId === time.id),
                  'clickable': isTelegram
                }">
                {{ time.start_time }} - {{ time.end_time }}
                <div class="availability" :class="{ 'selected': isTelegram && (selectedTimeId === time.id) }">
                  <p>Мест: {{ time.available_places_count }}</p>
                  <p v-if="time.available_penguin_count !== undefined">
                    Пингвинов: {{ time.available_penguin_count }}
                  </p>
                </div>
              </li>
            </ul>
          </li>
        </ul>

        <p v-else-if="filterType && !isLoading" class="no-sessions">
          {{ filterType === 'custom' ? 'На выбранную дату сеансов нет' : 'Расписания пока нет' }}
        </p>

      </template>
      <div v-if="!isTelegram" class="button-tg">
        <div class="button-tg__icon"> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clip-path="url(#clip0_550_1277)">
              <path d="M15 10L11 14L17 20L21 4L3 11L7 13L9 19L12 15" stroke="#ffffff" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" />
            </g>
            <defs>
              <clipPath id="clip0_550_1277">
                <rect width="24" height="24" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </div>
        <a href="https://t.me/roomly_test_bot" target="_blank">

          Купить билеты
        </a>
      </div>
    </div>

    <!-- Форма бронирования -->
    <form class="booking-form" @submit="handleSubmit">
      <template v-if="isReviewMode">
        <!-- Блок подтверждения заказа -->
        <div v-if="paymentStatus.loading" class="payment-loading">
          <h2>Проверка оплаты...</h2>
          <div class="spinner"></div>
          <p>Пожалуйста, подождите, пока мы проверяем статус вашего платежа</p>
        </div>

        <template v-else-if="paymentStatus.success === null">
          <h2>Предварительный просмотр заказа</h2>
          <div v-if="sessionDetails && selectedTime" class="order-summary">
            <div><strong>Сеанс №{{ sessionDetails.id }}</strong></div>
            <div>Дата: {{ formatDate(sessionDetails.date) }}</div>
            <div>Время: {{ selectedTime.start_time }} - {{ selectedTime.end_time }}</div>
            <div>Взрослые: {{ adults }}</div>
            <div>Дети: {{ children }}</div>
            <div v-if="penguinsCount > 0">Пингвины: {{ penguinsCount }}</div>
            <div v-if="skatesCount > 0">Коньки: {{ skatesCount }} пар</div>

            <div>Имя: {{ userName }}</div>
            <div>Телефон: {{ formatPhoneNumber(phoneNumber) }}</div>
            <div><strong>Базовая стоимость:</strong> {{ originalCost }} ₽</div>

            <!-- Блок акций -->
            <div v-if="promotions.length > 0" class="promotions-section">
              <h3>Акции на выбранную дату</h3>
              <div class="promotions-list">
                <div v-for="promotion in promotions.filter(p => isPromotionActive(p))" :key="promotion.id"
                  class="promotion-item" :class="{ 'added': isPromotionAdded(promotion.id) }">
                  <div class="promotion-header">
                    <span class="promotion-title">{{ promotion.title }}</span>
                    <div class="promotion-actions">
                      <button type="button" class="promotion-details" @click="openPromotionModal(promotion)">
                        Подробнее
                      </button>
                      <button type="button" class="promotion-toggle" @click="togglePromotion(promotion.id)">
                        {{ isPromotionAdded(promotion.id) ? 'Удалить' : 'Добавить' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Блок промокода -->
            <div class="promo-code-section">
              <div class="promo-code-header">
                <h3>Применить промокод</h3>
              </div>

              <div class="promo-code-input-group">
                <input type="text" v-model="promoCodeInput" placeholder="Введите промокод" :disabled="promoCodeApplied"
                  class="promo-code-input">
                <button type="button" @click="applyPromoCode" class="promo-code-button">
                  {{ promoCodeApplied ? 'Сбросить' : 'Применить' }}
                </button>
              </div>

              <div v-if="promoCodeError" class="error-message promo-error">
                {{ promoCodeError }}
              </div>

              <div v-if="promoCodeDetails" class="promo-code-success">
                Промокод применён! Скидка: {{ promoCodeDetails.sum }} ₽
                (максимум {{ promoCodeDetails.percentage_check }}% от суммы заказа)
              </div>
            </div>

            <div class="total-cost">
              <strong>Итого с учетом акций и скидок: {{ totalCost }} ₽</strong>
            </div>
          </div>

          <div class="payment-rules">
            <h3>Правила оплаты:</h3>
            <ol>
              <li>Оплата производится онлайн банковской картой.</li>
              <li>При отмене бронирования возврат средств возможен только в течение суток.</li>
              <li>Указанные контактные данные необходимы для связи с вами.</li>
            </ol>
          </div>

          <div class="form-actions">
            <button type="button" @click="completeOrder" class="primary">
              Перейти к оплате
            </button>
            <button type="button" @click="cancelReview" class="secondary">
              Назад
            </button>
          </div>
        </template>

        <template v-else-if="paymentStatus.success">
          <h2>Заказ успешно оплачен!</h2>
          <div class="order-success">
            <div><strong>Номер заказа:</strong> {{ paymentStatus.order.id }}</div>
            <div><strong>Номер платежа:</strong> {{ paymentStatus.order.payment_id }}</div>
            <div><strong>Пин-код:</strong> {{ paymentStatus.order.pin }}</div>
            <div><strong>Дата:</strong> {{ formatDate(paymentStatus.order.date) }}</div>
            <div><strong>Время:</strong> {{ paymentStatus.order.time }}</div>
            <div><strong>Количество человек:</strong> {{ paymentStatus.order.people_count }}</div>
            <div><strong>Стоимость:</strong> {{ paymentStatus.order.price }} ₽</div>
          </div>
          <div v-if="paymentStatus.order.promotions?.length" class="applied-promotions">
            <h3>Применённые акции:</h3>
            <ul>
              <li v-for="promotion in paymentStatus.order.promotions" :key="promotion.id">
                {{ promotion.title }}
              </li>
            </ul>
          </div>
          <button type="button" @click="cancelReview" class="primary">
            Вернуться к выбору сеанса
          </button>
        </template>

        <template v-else>
          <h2>Ошибка оплаты</h2>
          <p>Произошла ошибка при обработке платежа. Пожалуйста, попробуйте еще раз.</p>
          <button type="button" @click="resetPaymentStatus" class="primary">
            Попробовать снова
          </button>
        </template>
      </template>

      <template v-else>
        <!-- Основная форма -->
        <div v-if="sessionDetails && selectedTime" class="current-session">
          <strong>Сеанс №{{ sessionDetails.id }}</strong><br>
          Дата и время: {{ formatDate(sessionDetails.date) }} {{ selectedTime.start_time }}-{{ selectedTime.end_time }}
        </div>

        <div class="form-group">
          <label>Взрослые (от 11 лет и старше)</label>
          <input type="number" v-model.number="adults" min="1" required>
        </div>

        <div class="form-group">
          <label>Дети до 11 лет</label>
          <input type="number" v-model.number="children" min="0" required>
        </div>

        <div class="form-group" v-if="showPenguinsNeeds">
          <label class="checkbox-label">
            <input type="checkbox" v-model="needPenguins">
            <span>Требуется ли пингвин?</span>
          </label>
        </div>

        <div class="form-group" v-if="showPenguinsInput">
          <label>Необходимое количество пингвинов</label>
          <input type="number" v-model.number="penguinsCount" min="0" :max="children" required>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="needSkates">
            <span>Аренда коньков?</span>
          </label>
        </div>

        <div class="form-group" v-if="showSkatesInput">
          <label>Необходимое количество пар коньков</label>
          <input type="number" v-model.number="skatesCount" min="0" required>
        </div>

        <div class="form-group">
          <label>Ваше имя</label>
          <input type="text" v-model="userName" @blur="validateName(userName)" required>
          <div class="error-message" v-if="nameError">{{ nameError }}</div>
        </div>

        <div class="form-group">
          <label>Ваш телефон</label>
          <input type="tel" :value="formatPhoneNumber(phoneNumber)" @input="handlePhoneInput" @blur="handlePhoneBlur"
            placeholder="+7 (___) ___-__-__" required>
          <div class="error-message" v-if="phoneError">{{ phoneError }}</div>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="agreement">
            <span>Я согласен с обработкой персональных данных</span>
          </label>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="privacyPolicy">
            <span>Я согласен с <router-link to="/privacy-policy"  @click.stop>Политикой конфиденциальности</router-link></span>
          </label>
        </div>

        <div class="error-message form-error" v-if="checkboxError">
          {{ checkboxError }}
        </div>

        <div v-if="checkboxError && errorMessage" class="error-message form-error">
          {{ errorMessage }}
        </div>

        <div v-if="errorMessage" class="error-message form-error">{{ errorMessage }}</div>
        <button type="submit" class="primary">
          Оформить заказ
        </button>
      </template>
    </form>

    <!-- Модальное окно акции -->
    <div v-if="showPromotionModal && currentPromotion" class="modal-overlay" @click.self="showPromotionModal = false">
      <div class="modal-content">
        <button class="close-button" @click="showPromotionModal = false">×</button>

        <h2>{{ currentPromotion.title }}</h2>

        <img v-if="currentPromotion.image" :src="currentPromotion.image" :alt="currentPromotion.title"
          class="promotion-image">

        <div class="promotion-dates">
          Действует с {{ currentPromotion.start_date }} по {{ currentPromotion.end_date }}
        </div>

        <div class="promotion-description">
          {{ currentPromotion.description }}
        </div>

        <div class="promotion-discount">
          Скидка: {{ currentPromotion.sum }} ₽
        </div>

        <button type="button" class="add-button" @click="togglePromotion(currentPromotion.id)">
          {{ isPromotionAdded(currentPromotion.id) ? 'Удалить из заказа' : 'Добавить к заказу' }}
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&subset=latin,cyrillic');

.booking-container {
  font-family: 'Roboto', sans-serif;
  color: #064594;
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.booking-container.telegram {
  max-width: 100%;
  padding: 15px;
}

/* Стили фильтра */
.filter-container {
  margin-bottom: 20px;
}

.filter-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #064594;
  border-radius: 4px;
  background-color: #f5f9ff;
  font-size: 1rem;
  margin-bottom: 15px;
  color: #064594;
}

.date-picker {
  margin: 15px 0;
}

.date-picker label {
  display: block;
  margin-bottom: 5px;
}

.date-picker input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;

  border-radius: 4px;
  box-sizing: border-box;
}

.session-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.session-item {
  padding: 12px;
  margin-bottom: 10px;
  background-color: #f5f9ff;
  border: 1px solid #d0e0ff;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.session-item:hover {
  background-color: #e0ecff;
}

.time-list {
  list-style: none;
  padding: 0;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.time-item {

  padding: 8px;
  margin: 4px 0;
  background-color: #064594;
  border: 1px solid #c0d0ff;
  border-radius: 4px;
  cursor: pointer;
  color: #ffffff;

  p {
    margin: 0;
  }

}

.time-list.interactive .time-item {
  cursor: pointer;
  background-color: #064594;
  color: white;
}

.time-list.interactive .time-item:hover {
  background-color: #043a7a;
}

.time-item.selected-time {
  background-color: white;
  color: #064594;
  border: 2px solid #064594;
  font-weight: 500;
}

.availability {
  font-size: 0.8em;
  color: #ffffff;
  margin-top: 4px;

  &.selected {
    color: #064594;
  }
}

.time-list.interactive .availability,
.time-item.selected-time .availability {
  color: white;
}

.time-item.selected-time .availability {
  color: #064594;
}

/* Стили формы */
.booking-form {
  background-color: #f5f9ff;
  border: 1px solid #d0e0ff;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.booking-container.telegram .booking-form {
  padding: 15px;
  border-radius: 4px;
  border-left: none;
  border-right: none;
}

.current-session {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #d0e0ff;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

input[type="number"],
input[type="text"],
input[type="tel"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-label input {
  margin-right: 8px;
  width: auto;
}

.error-message {
  color: #d32f2f;
  font-size: 0.8em;
  margin-top: 5px;
}


.promotions-section {
  margin: 20px 0;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.promotions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.promotion-item {
  padding: 12px;
  background-color: white;
  border-radius: 6px;
  border: 1px solid #eee;
}

.promotion-item.added {
  border-color: #4caf50;
  background-color: #f8fbf8;
}

.promotion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.promotion-title {
  font-weight: 500;
  flex-grow: 1;
}

.promotion-actions {
  display: flex;
  gap: 8px;
}

.promotion-details {
  padding: 6px 12px;
  background-color: #f0f0f0;
  color: #064594;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.promotion-details:hover {
  background-color: #e0e0e0;
}

.promotion-toggle {
  padding: 6px 12px;
  background-color: #064594;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.promotion-toggle:hover {
  background-color: #043a7a;
}

.applied-promotions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #d0e0ff;
}

.applied-promotions h3 {
  margin-bottom: 10px;
  color: #064594;
}

.applied-promotions ul {
  padding-left: 20px;
  margin: 0;
}

.applied-promotions li {
  margin-bottom: 5px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 90%;
  width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #064594;
}

.promotion-image {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  margin: 10px 0;
  border-radius: 4px;
}

.promotion-dates {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 10px;
}

.promotion-description {
  margin: 15px 0;
  line-height: 1.5;
}

.promotion-discount {
  font-weight: bold;
  color: #064594;
  margin-bottom: 20px;
}

.add-button {
  background-color: #064594;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

.add-button:hover {
  background-color: #043a7a;
}

/* Блок промокода */
.promo-code-section {
  margin: 20px 0;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.promo-code-header h3 {
  margin: 0 0 15px 0;
  color: #064594;
  font-size: 1.1rem;
}

.promo-code-input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.promo-code-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
  min-width: 200px;
}

.promo-code-button {
  padding: 12px 20px;
  background-color: #064594;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.promo-code-button:hover {
  background-color: #043a7a;
}

.promo-code-button:hover:not(:disabled) {
  background-color: #043a7a;
}

.promo-code-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.promo-code-success {
  color: #2e7d32;
  background-color: #e8f5e9;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
  font-size: 0.9rem;
}

.promo-code-applied {
  color: #2e7d32;
  font-size: 0.9rem;
  margin-top: 10px;
  font-weight: 500;
}

.promo-error {
  margin-top: 5px;
  color: #d32f2f;
  font-size: 0.9rem;
}

/* Адаптация для мобильных */
@media (max-width: 480px) {
  .promo-code-input-group {
    flex-direction: column;
  }

  .promo-code-button {
    width: 100%;
  }
}

/* Кнопки */
button {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 25px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

button.primary {
  background-color: #064594;
  color: white;
  margin-top: 20px;
}

button.primary:hover {
  background-color: #043a7a;
}

button.secondary {
  background-color: #f0f0f0;
  color: #064594;
  margin-top: 10px;
}

button.secondary:hover {
  background-color: #e0e0e0;
}

.form-actions {
  margin-top: 20px;
}

.button-tg {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-decoration: none;
  text-align: center;
  color: #ffffff;
  background-color: #064594;
  padding: 12px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 50px;
}
.button-tg__icon {
  width: 18px;
  height: 18px;
}
.button-tg a,
.button-tg a:visited,
.button-tg a:hover,
.button-tg a:active {
  text-decoration: none;
  color: #ffffff !important;
  font-weight: 500;
}

/* Блоки информации */
.order-summary {
  margin-bottom: 20px;
}

.order-summary div {
  margin-bottom: 8px;
}

.total-cost {
  font-weight: bold;
  margin-top: 10px;
  font-size: 1.1em;
  padding-top: 10px;
  border-top: 1px solid #d0e0ff;
}

.payment-rules {
  margin: 20px 0;
}

.payment-rules ol {
  padding-left: 20px;
  margin-top: 10px;
}

.order-success {
  margin: 20px 0;
}

.order-success div {
  margin-bottom: 10px;
}

/* Сообщения */
.loading-message,
.error-message,
.no-sessions {
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
}

.loading-message {
  color: #064594;
  background-color: #f5f9ff;
}

.error-message {
  color: #d32f2f;
  background-color: #ffebee;
}

.no-sessions {
  color: #064594;
  font-style: italic;
}

/* Анимация загрузки */
.payment-loading {
  text-align: center;
  padding: 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 20px auto;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #064594;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* Адаптация для мобильных */
@media (max-width: 480px) {
  .booking-container {
    padding: 15px;
  }

  .session-item {
    padding: 10px;
  }

  .time-item {
    padding: 8px;
    font-size: 0.9em;
  }

  .booking-form {
    padding: 15px;
  }

  input[type="number"],
  input[type="text"],
  input[type="tel"] {
    padding: 8px;
  }

  .promo-code-input {
    flex-direction: column;
  }

  .promo-code-input button {
    width: 100%;
  }
}
</style>
