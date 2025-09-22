<script setup lang="ts">
import { ref, computed, onUnmounted, watch, onMounted } from 'vue';
import { getSessionDetails, getOrderPrice, createOrder, getSessions, checkOrderStatus, checkPromoCode, getPromotions, getUserData } from '../services/api';
import AgreementModal from './AgreementModal.vue';
import PrivacyPolicyModal from './PrivacyPolicyModal.vue';
import RulesModal from './RulesModal.vue';
import { formatDate } from '../utils/dateFormatter';
import { formatPhoneNumber, normalizePhoneNumber, validatePhone } from '../utils/phoneFormatter';

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
        close?: () => void;
      };
    };
  }
}

interface Session {
  id: number;
  date: string;
  day_of_week: string;
}

interface SessionTime {
  id: number;
  start_time: string;
  end_time: string;
  available_places_count: number;
  available_penguin_count: number;
  number: number
}

interface SessionDetails {
  id: number;
  date: string;
  day_of_week: string;
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

interface UserData {
  full_name: string  | null;
  phone: string  | null;
  email: string | null;
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

const isLoadingUser = ref(true);
const noUserData = ref(false);
const sessions = ref<Session[]>([]);
const filterType = ref<FilterType>('');
const customDate = ref('');
const sessionId = ref<number | null>(null);
const selectedTimes = ref<SessionTime[]>([]);
const selectedTimeId = ref<number | null>(null);
const sessionDetails = ref<SessionDetails | null>(null);
const adults = ref(0);
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
const originalCost = ref(0);
const isReviewMode = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const penguinError = ref('');
const scatesError = ref('');
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
const showConfirmDialog = ref(false);
const paymentUrl = ref('');
const showAgreementModal = ref(false);
const showPolicyModal = ref(false);
const showRulesModal = ref(false);
const ticketsExceeded = ref(false);
const userData = ref<UserData | null>(null);
const sendCheck = ref(true)
const userEmail = ref('');
const emailError = ref('')

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
      tgWebApp.value.ready?.();
      isTelegramReady.value = true;

      if (!tgWebApp.value.isExpanded) {
        tgWebApp.value.expand?.();
      }

      initData.value = tgWebApp.value.initData || '';
      
    }
  } catch (error) {
    console.error('Ошибка инициализации Telegram WebApp:', error);
  }
};

const closeWebApp = () => {
  if (isTelegram.value && tgWebApp.value) {
    tgWebApp.value.close()
  }
  
}

onMounted(async () => {
  
  isTelegram.value = checkTelegramWebApp();

  if (isTelegram.value) {
    await initTelegramWebApp();
  }
  await fetchUserData();
  const urlParams = new URLSearchParams(window.location.search);
  const paymentUuid = urlParams.get('uuid');

  if (paymentUuid) {
    checkPaymentStatusAfterReturn(paymentUuid);
  }
});

const checkPaymentStatusAfterReturn = async (uuid: string) => {
  try {
    paymentStatus.value = { loading: true, success: null, order: null };
    const status = await checkOrderStatus(uuid);

    if (status.success) {
      paymentStatus.value = { loading: false, success: true, order: status.order };
      isReviewMode.value = true;
    } else {
      paymentStatus.value = { loading: false, success: false, order: null };
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    console.error('Ошибка проверки статуса платежа:', error);
    paymentStatus.value = { loading: false, success: false, order: null };
  }
};

const showPenguinsNeeds = computed(() => children.value > 0);
const showPenguinsInput = computed(() => needPenguins.value);
const showSkatesInput = computed(() => needSkates.value);
const showDatePicker = computed(() => filterType.value === 'custom');
const selectedTime = computed(() => {
  return selectedTimes.value.find(time => time.id === selectedTimeId.value) || null;
});

const validateTickets = () => {
  const total = adults.value + children.value;
  ticketsExceeded.value = total > 10;
  return !ticketsExceeded.value;
}

// Вызываем валидацию при изменении полей
watch([adults, children], () => {
  validateTickets();
  if (sessionId.value && selectedTimeId.value) {
    calculatePrice();
  }
});

const validateSkates = () => {
  if ((adults.value + children.value) < skatesCount.value) {
    scatesError.value = "Коньков не может быть больше, чем билетов";
    return false;
  }

  else {
    scatesError.value = '';
    return true;
  }
}

const validatePinguins = () => {
  if (children.value < penguinsCount.value) {
    penguinError.value = "Пингвинов не может быть больше, чем детских билетов";
    return false;
  }

  else {
    penguinError.value = '';
    return true;
  }
}

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


const validateEmail = (email: string): boolean => {
  if (sendCheck.value) {
    if (!/^(|([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))$/.test(email)) {
      emailError.value = 'Введите правильный адрес электронной почты';
      return false;
    }

    if (!email.trim()) {
      emailError.value = 'Введите адрес электронной почты';
      return false;
    }
  }
 
  emailError.value = '';
  return true;
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
    // await fetchUserData();
    
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
    selectedTimeId.value = null;
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

const fetchUserData = async () => {
  try {
    isLoadingUser.value = true
    const payload: Record<string, any> = {
      ...(isTelegram.value && initData.value && { InitData: initData.value })
    };
    userData.value = await getUserData(payload);
    userName.value = userData.value?.full_name || ''
    phoneNumber.value = formatPhoneNumber(userData.value?.phone || '')
    userEmail.value = userData.value?.email || ''
    noUserData.value = false
  } catch (error) {
    noUserData.value = true
    console.error('Ошибка загрузки данных пользователя:', error);
  }
  finally {
    isLoadingUser.value = false
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

const calculatePrice = async () => {
  if (!sessionId.value || !selectedTimeId.value) return;

  try {
    const payload = {
      session: sessionId.value,
      time: selectedTimeId.value,
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

    if (!promoCodeApplied.value && selectedPromotions.value.length === 0) {
      originalCost.value = priceResult.price;
    }
    errorMessage.value = '';
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
    errorMessage.value = extractErrorMessage(error);
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
      promoCodeInput.value = '';
      promoCode.value = '';
      promoCodeApplied.value = false;
      promoCodeDetails.value = null;
    } else {
      if (!promoCodeInput.value.trim()) {
        promoCodeError.value = 'Введите промокод';
        return;
      }

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

    await calculatePrice();
  } catch (error) {
    console.error('Ошибка:', error);
    promoCodeError.value = 'Ошибка при обработке промокода';
  }
};

const extractErrorMessage = (error: any): string => {

  if (error?.response?.data) {
    const data = error.response.data;

    if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
      return data.non_field_errors[0];
    }

    if (data.message) {
      return data.message;
    }

    const errorFields = Object.keys(data).filter(key =>
      Array.isArray(data[key]) && data[key].length > 0
    );

    if (errorFields.length > 0) {
      return data[errorFields[0]][0];
    }
  }

  if (error?.message) {
    return error.message;
  }

  return 'Произошла неожиданная ошибка';
};

const handleSubmit = async (event: Event) => {
  event.preventDefault();
  scatesError.value = '';
  penguinError.value = '';
  checkboxError.value = '';
  errorMessage.value = '';

  if (!sessionId.value || !selectedTimeId.value) {
    errorMessage.value = 'Пожалуйста, выберите дату и время';
    return;
  }

  if (!sessionId.value || (isTelegram.value && !selectedTimeId.value)) {
    errorMessage.value = 'Пожалуйста, выберите дату и время';
    return;
  }

  if (!adults.value && !children.value) {
    errorMessage.value = 'Пожалуйста, укажите количество билетов';
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
    const basePricePayload = {
      session: sessionId.value,
      time: selectedTimeId.value,
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

    if (promoCodeApplied.value || selectedPromotions.value.length > 0) {
      await calculatePrice();
    } else {
      totalCost.value = originalCost.value;
    }

    isReviewMode.value = true;
    paymentStatus.value = { loading: false, success: null, order: null };
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
    errorMessage.value = extractErrorMessage(error);
  }
};

const openConfirmDialog = (url: string) => {
  paymentUrl.value = url;
  showConfirmDialog.value = true;
};

const handleConfirm = () => {
  showConfirmDialog.value = false;

  // Для iOS открываем через window.location
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.location.href = paymentUrl.value;
  } else {
    paymentWindow.value = window.open(paymentUrl.value, '_blank');
  }
};

const handleCancel = () => {
  showConfirmDialog.value = false;
  paymentStatus.value = { loading: false, success: null, order: null };
};

const completeOrder = async () => {
  if (!sessionId.value || !selectedTimeId.value) return;

  if (sendCheck.value && !validateEmail(userEmail.value)) {
    return;
  }

  try {
    paymentStatus.value = { loading: true, success: null, order: null };
    errorMessage.value = '';

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
      send_check: sendCheck.value,
      user_email: userEmail.value,
      ...(isTelegram.value && initData.value && { InitData: initData.value })
    };

    const response = await createOrder(payload);

    // Для iOS добавляем параметр возврата с UUID
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      const returnUrl = `${window.location.origin}${window.location.pathname}?uuid=${response.uuid}`;
      const paymentUrlWithReturn = `${response.payment_url}&return_url=${encodeURIComponent(returnUrl)}`;
      openConfirmDialog(paymentUrlWithReturn);
    } else {
      // Для десктопа и других платформ стандартное поведение
      paymentWindow.value = window.open(response.payment_url, '_blank');
      startPaymentStatusCheck(response.uuid);
    }
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    paymentStatus.value = { loading: false, success: false, order: null };
    errorMessage.value = extractErrorMessage(error);
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
  if (sessionId.value) {
     getDateTimes({ 
    id: sessionId.value, 
    date: sessionDetails.value?.date || '',
    day_of_week: sessionDetails.value?.day_of_week || ''
  } as Session);
  }
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
  <div class="booking-container">
  <div v-if="isLoadingUser" class="loading-container">
      <div class="spinner"></div>
  </div>
  <div class="no-user"  v-else-if="noUserData">
    <p>Вы не приняли согласие на обработку персональных данных, с правилами посещения Ледовой Арены и политикой конфиденциальности в боте. <br>
Примите согласие и повторите снова</p>
<button @click="closeWebApp" class="primary return-button">Вернуться в бота</button>
  </div>
  <div v-else class="booking-container" :class="{ 'telegram': isTelegram }">
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

      <template v-else>
        <ul v-if="sessions.length > 0" class="session-list">
          <li v-for="session in sessions" :key="session.id" @click="getDateTimes(session)" class="session-item"
            :class="{ 'selected': sessionId === session.id }">
            {{ formatDate(session.date) }} , {{session.day_of_week }}

            <ul v-if="sessionId === session.id && selectedTimes.length" class="time-list">
              <li v-for="time in selectedTimes" :key="time.id" @click.stop="selectedTimeId = time.id" class="time-item"
                :class="{
                  'selected-time': selectedTimeId === time.id,
                }">
                {{ time.start_time }} - {{ time.end_time }}
                <div class="availability" :class="{ 'selected': selectedTimeId === time.id }">
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
    </div>

    <!-- Форма бронирования -->
    <form class="booking-form" @submit="handleSubmit">
      <template v-if="isReviewMode">
        <!-- Блок подтверждения заказа -->
        <div v-if="paymentStatus.loading" class="payment-loading">
          <h2>Ожидание оплаты...</h2>
          <div class="spinner"></div>
          <p>Пожалуйста, подождите, пока мы проверяем статус вашего платежа. Если Вы передумали оплачивать текущий заказ, обновите страницу и создайте заказ заново.</p>
        </div>

        <template v-else-if="paymentStatus.success === null">
          <h2>Предварительный просмотр заказа</h2>
          <div v-if="sessionDetails && selectedTime" class="order-summary">
            <div><strong>Сеанс №{{ selectedTime.number }}</strong></div>
            <div>Дата: {{ formatDate(sessionDetails.date) }}, {{sessionDetails.day_of_week}}</div>
            <div>Время: {{ selectedTime.start_time }} - {{ selectedTime.end_time }}</div>
            <div>Взрослые: {{ adults }}</div>
            <div>Дети: {{ children }}</div>
            <div v-if="penguinsCount > 0">Пингвины: {{ penguinsCount }} (шт.)</div>
            <div v-if="skatesCount > 0">Коньки: {{ skatesCount }} (п.)</div>

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
              <strong>Итого <span class="total-cost__descr">(с учетом акций и скидок)</span>: {{ totalCost }} ₽</strong>
            </div>
          </div>

          <div>
            <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="sendCheck">
                    <span>Отправить чек на email</span>
              </label>
            </div>
            <div class="form-group">
              <input type="text" v-model="userEmail" @blur="validateEmail(userEmail)">
              <div class="error-message" v-if="emailError">{{ emailError }}</div>
            </div>
          </div>

          <div class="payment-rules">
            <h3>ВНИМАНИЕ! Прочтите до конца!</h3>
            <ol>
              <li>Ознакомьтесь с <a href='#' class="link" @click.prevent="showRulesModal = true"><strong>правилами
                    посещения Ледовой арены IceMETP</strong></a></li>
              <li>Оплачивая заказ Вы соглашаетесь с правилами посещения Ледовой арены IceMETP.</li>
              <li>На оплату заказа Вам дается 10 минут, иначе заказ будет отменен.</li>
              <li>После оплаты в чат бот Вам придет информация о покупке, которая будет содержать <strong>ПИН-КОД</strong>, по которому
                Вы получите пропуск на арену.</li>
              <li>Внимательно проверьте состав заказа, дату и время сеанса, так как билеты являются НЕВОЗВРАТНЫМИ!</li>
              <li>Нажимая кнопку "Перейти к оплате", Вы подтверждаете, что ознакомились с правилами и согласны с ними.
              </li>
            </ol>
          </div>
          <div v-if="errorMessage" class="error-message form-error">
            {{ errorMessage }}
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
            <div><strong>Дата:</strong> {{ formatDate(paymentStatus.order.date) }}, {{ paymentStatus.order.day_of_week }}</div>
            <div><strong>Время:</strong> {{ paymentStatus.order.time }}</div>
            <div><strong>Количество человек:</strong> {{ paymentStatus.order.people_count }}</div>
            <div><strong>Стоимость:</strong> {{ paymentStatus.order.price }} ₽</div>
          </div>

          <button type="button" @click="cancelReview" class="primary">
            Вернуться к выбору сеанса
          </button>
        </template>

        <template v-else>
          <h2>Ошибка оплаты</h2>
          <div v-if="errorMessage" class="error-message form-error">
            {{ errorMessage }}
          </div>
          <p>Произошла ошибка при обработке платежа. Пожалуйста, попробуйте еще раз.</p>
          <button type="button" @click="resetPaymentStatus" class="primary">
            Попробовать снова
          </button>
        </template>
      </template>

      <template v-else>
        <!-- Основная форма -->
        <div v-if="sessionDetails && selectedTime" class="current-session">
          <strong>Сеанс №{{ selectedTime.number }}</strong><br>
          <p>Дата: {{ formatDate(sessionDetails.date) }}, {{ sessionDetails.day_of_week }}</p>
          <p>Время:  {{ selectedTime.start_time }}-{{ selectedTime.end_time }}</p>
          
        </div>

        <div class="form-group" :class="{ 'has-error': ticketsExceeded }">
          <label>Взрослые (от 11 лет и старше)</label>
          <input type="number" v-model.number="adults" min="0" @blur="validateTickets">
        </div>

        <div class="form-group" :class="{ 'has-error': ticketsExceeded }">
          <label>Дети (до 11 лет)</label>
          <input type="number" v-model.number="children" min="0" @blur="validateTickets">
        </div>

        <div class="error-message" v-if="ticketsExceeded">
          В одном заказе может быть максимум 10 билетов
        </div>

        <div class="form-group" v-if="showPenguinsNeeds">
          <label class="checkbox-label">
            <input type="checkbox" v-model="needPenguins">
            <span>Требуется ли фигура-помощник "Пингвин" (для детей до 7 лет)?</span>
          </label>
        </div>

        <div class="form-group" v-if="showPenguinsInput">
          <label>Необходимое количество пингвинов</label>
          <input type="number" v-model.number="penguinsCount" min="0" :max="children" required @blur="validatePinguins">
          <div class="error-message" v-if="penguinError">{{ penguinError }}</div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="needSkates">
            <span>Аренда коньков?</span>
          </label>
        </div>

        <div class="form-group" v-if="showSkatesInput">
          <label>Необходимое количество пар коньков</label>
          <input type="number" v-model.number="skatesCount" min="0" :max="adults + children" required
            @blur="validateSkates">
          <div class="error-message" v-if="scatesError">{{ scatesError }}</div>
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
            <span>Я согласен с <a href="#" class="link" @click.prevent="showAgreementModal = true"> обработкой персональных данных</a></span>
          </label>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="privacyPolicy">
            <span>Я согласен с <a href="#" class="policy-link" @click.prevent="showPolicyModal = true">Политикой
                конфиденциальности</a></span>
          </label>
        </div>

        <div class="error-message form-error" v-if="checkboxError">
          {{ checkboxError }}
        </div>

        <div v-if="checkboxError && errorMessage" class="error-message form-error">
          {{ errorMessage }}
        </div>

        <div v-if="errorMessage" class="error-message form-error">{{ errorMessage }}</div>
        <button type="submit" class="primary order-button">
          Оформить заказ
        </button>
      </template>
    </form>
    <!-- Модальное окно подтверждения оплаты -->
    <div v-if="showConfirmDialog" class="modal-overlay">
      <div class="modal-content">
        <h3>Подтверждение оплаты</h3>
        <p>Вы будете перенаправлены на страницу оплаты.</p>
        <p>После завершения оплаты вы вернетесь обратно в приложение.</p>

        <div class="form-actions">
          <button @click="handleConfirm" class="primary">Продолжить</button>
          <button @click="handleCancel" class="secondary">Отмена</button>
        </div>
      </div>
    </div>

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
          Стоимость: {{ currentPromotion.sum }} ₽
        </div>

        <button type="button" class="add-button" @click="togglePromotion(currentPromotion.id)">
          {{ isPromotionAdded(currentPromotion.id) ? 'Удалить из заказа' : 'Добавить к заказу' }}
        </button>
      </div>
    </div>
  </div>
  <AgreementModal :showAgreementModal="showAgreementModal" @close="showAgreementModal = false"
    @click.self="showAgreementModal = false" />
  <PrivacyPolicyModal :showPolicyModal="showPolicyModal" @close="showPolicyModal = false"
    @click.self="showPolicyModal = false" />
  <RulesModal :showRules="showRulesModal" @close="showRulesModal = false" @click.self="showRulesModal = false" />
   </div>
</template>

<style lang="scss" scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&subset=latin,cyrillic');

.booking-container {
  font-family: 'Roboto', sans-serif;
  color: #064594;
  max-width: 500px;
  margin: 0 auto;
  padding: 10px;
}

.booking-container.telegram {
  max-width: 100%;
  padding: 10px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.booking-container.no-user {
  padding: 20px;
  text-align: center;
  background-color: #f5f9ff;
  border: 1px solid #d0e0ff;
  border-radius: 8px;
  margin: 20px;
}

.booking-container.no-user p {
  margin: 0;
  color: #064594;
  font-size: 16px;
  line-height: 1.5;
}
.return-button {
  margin-top: 10px;
  background-color: #064594;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.return-button:hover {
  background-color: #043a7a;
}

/* Стили фильтра */
.filter-container {
  margin-bottom: 20px;
}

.filter-select {
  width: 100%;
  min-height: 50px;
  padding: 10px 15px;
  border: 1px solid #064594;
  border-radius: 4px;
  background-color: #f5f9ff;
  font-size: 1.1rem;
  font-weight: 700;
  margin-top: 30px;
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

.time-item.selected-time {
  background-color: white;
  color: #064594;
  border: 2px solid #064594;
  font-weight: 500;
  box-sizing: border-box;
}

.availability {
  font-size: 0.8em;
  color: #ffffff;
  margin-top: 4px;

  &.selected {
    color: #064594;
  }
}

.time-item.selected-time .availability {
  color: #064594;
}

.booking-form, .no-user {
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
  gap: 8px;
}

.checkbox-label input {
  margin-right: 8px;
  width: auto;
}

.policy-link,
.link {
  text-decoration: none;
  color: #064594;
  text-decoration: underline;
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
  max-width: 500px;
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
  margin: 0;
  padding: 0;
  line-height: 1;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.promotion-image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  margin: 10px 0;
  border-radius: 6px;
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
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  font-size: 1.1rem;
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
  padding: 0 10px;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 90%;
  width: 400px;
  max-height: 90vh;
  overflow-y: auto;
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

.total-cost__descr {
  font-size: 0.8rem;
}

.payment-rules {
  border-top: 1px solid #d0e0ff;
  margin: 20px 0;
}

.payment-rules ol {
  padding-left: 20px;
  margin-top: 10px;
}

.payment-rules li {
  padding-bottom: 10px;
  font-size: 14px;
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
  font-size: 14px;
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

@media (max-width: 480px) {
  .filter-select {
    font-size: 1rem;
  }

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

.has-error input {
  border-color: 2px solid #d32f2f;
  background-color: #ffebee;
}
</style>
