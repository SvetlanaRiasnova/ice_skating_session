<script setup lang="ts">
import { ref, computed, onUnmounted, watch, onMounted } from 'vue';
import { getSessionDetails, getOrderPrice, createOrder, getSessions, checkOrderStatus,checkPromoCode } from '../services/api';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        openInvoice?: (url: string, callback: (status: string) => void) => void;
        version?: string;
        platform?: string;
        isExpanded?: boolean;
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
const originalCost = ref(0);
const isReviewMode = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const agreement = ref(false);
const privacyPolicy = ref(false);
const nameError = ref('');
const checkboxError = ref('');
const paymentWindow = ref<Window | null>(null);
const checkStatusInterval = ref<number | null>(null);

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

onMounted(() => {
  isTelegram.value = checkTelegramWebApp();
  console.log('isTelegram:', isTelegram.value);
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
const applyPromoCode = async () => {
  promoCodeError.value = '';
  
  if (!sessionId.value || !selectedTimeId.value) {
    promoCodeError.value = 'Сначала выберите дату и время сеанса';
    return;
  }

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
      promo_code: promoCodeInput.value.trim() || null,
      promotions: []
    };

    if (promoCodeApplied.value && promoCodeInput.value === promoCode.value) {
      payload.promo_code = null;
    }

    const priceResult = await getOrderPrice(payload);
    
    if (payload.promo_code) {
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
        throw error;
      }
    } else {
      promoCodeInput.value = '';
      promoCode.value = '';
      promoCodeApplied.value = false;
      promoCodeDetails.value = null;
    }
    
    totalCost.value = priceResult.price;
    originalCost.value = priceResult.price;
    
  } catch (error) {
    console.error('Ошибка:', error);
    
    if (isApiError(error)) {
      promoCodeError.value = error.response?.status === 404
        ? 'Промокод недействителен или уже был использован'
        : error.response?.data?.message || 'Ошибка при расчете стоимости';
    } else if (error instanceof Error) {
      promoCodeError.value = error.message;
    } else {
      promoCodeError.value = 'Неизвестная ошибка';
    }
    
    try {
      const priceResult = await getOrderPrice({
        session: sessionId.value,
        session_time: selectedTimeId.value,
        adult_count: adults.value,
        child_count: children.value,
        penguin_count: penguinsCount.value,
        skates_count: skatesCount.value,
        user_name: userName.value,
        user_phone: phoneNumber.value,
        promo_code: null,
        promotions: []
      });
      totalCost.value = priceResult.price;
    } catch (innerError) {
      console.error('Ошибка расчета стоимости:', innerError);
    }
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
    const priceResult = await getOrderPrice({
      session: sessionId.value,
      session_time: selectedTimeId.value,
      adult_count: adults.value,
      child_count: children.value,
      penguin_count: penguinsCount.value,
      skates_count: skatesCount.value,
      user_name: userName.value,
      user_phone: phoneNumber.value,
      promo_code: null // Исправлено: передаем null вместо отсутствующего значения
    });
    
    originalCost.value = priceResult.price;
    totalCost.value = priceResult.price;
    isReviewMode.value = true;
    paymentStatus.value = { loading: false, success: null, order: null };
    promoCodeApplied.value = false;
    promoCodeInput.value = '';
    promoCode.value = '';
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
    errorMessage.value = 'Ошибка при расчете стоимости';
  }
};

const completeOrder = async () => {
  if (!sessionId.value || !selectedTimeId.value) return;

  try {
    paymentStatus.value = { loading: true, success: null, order: null };
    
    // Prepare the payload
    const payload: Record<string, any> = {
      session: sessionId.value,
      adult_count: adults.value,
      child_count: children.value,
      penguin_count: penguinsCount.value,
      skates_count: skatesCount.value,
      time: selectedTimeId.value,
      user_name: userName.value,
      user_phone: phoneNumber.value,
      promo_code: promoCode.value ? promoCode.value : null, // Исправлено: передаем null если промокода нет
      promotions: [] // Добавляем пустой массив promotions
    };
     console.log('Отправляемые данные:', payload);
    const response = await createOrder(payload);

    if (isTelegram.value && window.Telegram?.WebApp?.openInvoice) {
      window.Telegram.WebApp.openInvoice(response.payment_url, (status: string) => {
        if (status === 'paid') {
          paymentStatus.value = { loading: false, success: true, order: response };
        } else {
          paymentStatus.value = { loading: false, success: false, order: null };
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
        <input 
          type="date" 
          v-model="customDate" 
          :min="new Date().toISOString().split('T')[0]" 
          :disabled="isLoading"
        />
      </div>

      <div v-if="isLoading" class="loading-message">Загрузка сеансов...</div>
      <div v-else-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      
      <template v-else>
        <ul v-if="sessions.length > 0" class="session-list">
          <li 
            v-for="session in sessions" 
            :key="session.id" 
            @click="getDateTimes(session)" 
            class="session-item"
            :class="{ 'selected': sessionId === session.id }"
          >
            {{ formatDate(session.date) }}

            <ul 
              v-if="sessionId === session.id && selectedTimes.length" 
              class="time-list"
              :class="{ 'interactive': isTelegram }"
            >
              <li 
                v-for="time in selectedTimes" 
                :key="time.id" 
                @click.stop="selectedTimeId = time.id" 
                class="time-item"
                :class="{ 
                  'selected-time': isTelegram && (selectedTimeId = time.id),
                  'clickable': isTelegram
                }"
              >
                {{ time.start_time }} - {{ time.end_time }}
                <div class="availability" :class="{ 'selected': isTelegram && (selectedTimeId = time.id) }">
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
    <form 
      class="booking-form" 
      @submit="handleSubmit" 
    >
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
            <div><strong>Стоимость:</strong> {{ totalCost }} ₽</div>
            <!-- Блок промокода -->
             <div class="promo-code-section">
    <div class="promo-code-header">
      <h3>Применить промокод</h3>
    </div>
    
    <div class="promo-code-input-group">
      <input
        type="text"
        v-model="promoCodeInput"
        placeholder="Введите промокод"
        :disabled="promoCodeApplied"
        class="promo-code-input"
      >
      <button
        type="button"
        @click="applyPromoCode"
        class="promo-code-button"
      >
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
            
            <div class="total-cost">Итого: {{ totalCost }} ₽</div>
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
            <div><strong>Пин-код:</strong> {{ paymentStatus.order.pin }}</div>
            <div><strong>Дата:</strong> {{ formatDate(paymentStatus.order.date) }}</div>
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
          <input 
            type="number" 
            v-model.number="penguinsCount" 
            min="0" 
            :max="children" 
            required
          >
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
          <input 
            type="tel" 
            :value="formatPhoneNumber(phoneNumber)"
            @input="handlePhoneInput"
            @blur="handlePhoneBlur"
            placeholder="+7 (___) ___-__-__"
            required
          >
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
            <span>Я согласен с <a href="https://icemetr.ru/policy" target="_blank">политикой конфиденциальности</a></span>
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
  border-radius: 0;
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
<!-- <script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue';
import { getSessionDetails, getOrderPrice, createOrder, getSessions, checkOrderStatus } from '../services/api';

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

type FilterType = '' | 'nearest' | 'weekend' | 'custom';

const paymentStatus = ref<{
  loading: boolean;
  success: boolean | null;
  order: any;
}>({
  loading: false,
  success: null,
  order: null
});

const sessions = ref<Session[]>([]);
const filterType = ref<FilterType>('');
const customDate = ref<string>('');
const sessionId = ref<number | null>(null);
const selectedTimes = ref<SessionTime[]>([]);
const selectedTimeId = ref<number | null>(null);
const sessionDetails = ref<SessionDetails | null>(null);
const adults = ref<number>(1);
const children = ref<number>(0);
const needPenguins = ref<boolean>(false);
const penguinsCount = ref<number>(0);
const needSkates = ref<boolean>(false);
const skatesCount = ref<number>(0);
const userName = ref<string>('');
const phoneNumber = ref<string>('');
const phoneError = ref<string>('');
const promoCode = ref<string>('');
const totalCost = ref<number>(0);
const isReviewMode = ref<boolean>(false);
const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');

const paymentWindow = ref<Window | null>(null);
const checkStatusInterval = ref<number | null>(null);

const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 11 && (cleaned[0] === '7' || cleaned[0] === '8');
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  } catch (e) {
    console.error('Ошибка форматирования даты:', e);
    return dateString; 
  }
};

const formatPhoneNumber = (value: string): string => {
  let cleaned = value.replace(/\D/g, '');
  
  
  if (cleaned.length > 0 && !['7', '8'].includes(cleaned[0])) {
    cleaned = '7' + cleaned; 
  }
  
  cleaned = cleaned.substring(0, 11);
  
  let formattedValue = '';
  
  if (cleaned.length > 0) {
    formattedValue = `+${cleaned[0]} `;
    
    if (cleaned.length > 1) {
      formattedValue += '(' + cleaned.substring(1, 4);
    }
    if (cleaned.length > 4) {
      formattedValue += ') ' + cleaned.substring(4, 7);
    }
    if (cleaned.length > 7) {
      formattedValue += '-' + cleaned.substring(7, 9);
    }
    if (cleaned.length > 9) {
      formattedValue += '-' + cleaned.substring(9, 11);
    }
  }
  
  return formattedValue;
};

const handlePhoneInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  let value = input.value.replace(/\D/g, '');
  
  // Сохраняем первую цифру (7 или 8), остальные обрезаем до 10
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
  
  if (!validatePhone(phoneNumber.value)) {
    phoneError.value = 'Введите корректный номер телефона (начинается с 7 или 8)';
  } else {
    phoneError.value = '';
  }
};


const showPenguinsNeeds = computed(() => children.value > 0);
const showPenguinsInput = computed(() => needPenguins.value);
const showSkatesInput = computed(() => needSkates.value);
const showDatePicker = computed(() => filterType.value === 'custom');
const selectedTime = computed(() => {
  if (!selectedTimeId.value || !selectedTimes.value.length) return null;
  return selectedTimes.value.find(time => time.id === selectedTimeId.value);
});

watch(filterType, (newVal) => {
  sessions.value = [];
  sessionId.value = null;
  selectedTimes.value = [];
  selectedTimeId.value = null;
  
  if (newVal && newVal !== 'custom') {
    loadSessions();
  }
});

watch(customDate, (newVal) => {
  if (filterType.value === 'custom' && newVal) {
    loadSessions();
  }
});

async function loadSessions() {
  if (!filterType.value) return;

  if (filterType.value === 'custom' && !customDate.value) {
    errorMessage.value = 'Пожалуйста, выберите дату';
    sessions.value = [];
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const res = await getSessions(filterType.value, customDate.value);
    sessions.value = res;
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

const handleSubmit = async (event: Event) => {
  event.preventDefault();

  if (!sessionId.value || !selectedTimeId.value) {
    errorMessage.value = 'Пожалуйста, выберите дату и время';
    return;
  }

  const payload = {
    session: sessionId.value,
    session_time: selectedTimeId.value,
    adult_count: adults.value,
    child_count: children.value,
    penguin_count: penguinsCount.value,
    skates_count: skatesCount.value,
    user_name: userName.value,
    user_phone: phoneNumber.value,
    promo_code: promoCode.value
  };

  try {
    const priceResult = await getOrderPrice(payload);
    totalCost.value = priceResult.price;
    isReviewMode.value = true;
    paymentStatus.value = { loading: false, success: null, order: null };
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
  }
};

const completeOrder = async () => {
  if (!sessionId.value || !selectedTimeId.value) return;

  const payload = {
    session: sessionId.value,
    adult_count: adults.value,
    child_count: children.value,
    penguin_count: penguinsCount.value,
    skates_count: skatesCount.value,
    time: selectedTimeId.value,
    user_name: userName.value,
    user_phone: phoneNumber.value
  };

  try {
    paymentStatus.value = { loading: true, success: null, order: null };
    const response = await createOrder(payload);

    paymentWindow.value = window.open(response.payment_url, '_blank');
    startPaymentStatusCheck(response.uuid);

  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    paymentStatus.value = { loading: false, success: false, order: null };
    errorMessage.value = 'Ошибка при создании заказа';
  }
};

const startPaymentStatusCheck = (uuid: string) => {
  if (checkStatusInterval.value) {
    clearInterval(checkStatusInterval.value);
  }

  checkStatusInterval.value = window.setInterval(async () => {
    try {
      const status = await checkOrderStatus(uuid);

      if (status.success) {
        clearInterval(checkStatusInterval.value!);
        paymentStatus.value = {
          loading: false,
          success: true,
          order: status.order
        };

        if (paymentWindow.value && !paymentWindow.value.closed) {
          paymentWindow.value.close();
        }
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
};

onUnmounted(() => {
  if (checkStatusInterval.value) {
  window.clearInterval(checkStatusInterval.value);
  checkStatusInterval.value = null;
}
  if (paymentWindow.value && !paymentWindow.value.closed) {
    paymentWindow.value.close();
  }
});
</script>

<template>
  <div class="filter-container" v-if="!isReviewMode">
    <select v-model="filterType"  class="filter-select">
      <option value="" disabled selected>Выберите дату и время сеанса</option>
      <option value="nearest">Ближайшие три дня</option>
      <option value="weekend">Ближайшие выходные</option>
      <option value="custom">Определённая дата</option>
    </select>

    <div v-if="showDatePicker" class="date-picker">
      <label>Выберите дату:</label>
      <input type="date" v-model="customDate" @change="loadSessions" :min="new Date().toISOString().split('T')[0]" />
    </div>

    <div v-if="isLoading" class="loading-message">Загрузка сеансов...</div>
    <div v-else-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <template v-else>
      <ul v-if="sessions.length > 0" class="session-list">
        <li v-for="session in sessions" :key="session.id" @click="getDateTimes(session)" class="session-item"
          :class="{ 'selected': sessionId === session.id }">
          {{ formatDate(session.date) }}

          <ul v-if="sessionId === session.id && selectedTimes.length" class="time-list">
            <li v-for="time in selectedTimes" :key="time.id" @click.stop="selectedTimeId = time.id" class="time-item"
              :class="{ 'selected-time': selectedTimeId === time.id }">
              {{ time.start_time }} - {{ time.end_time }}
              <div class="availability" :class="{'selected': selectedTimeId === time.id}">
                <p>Мест: {{ time.available_places_count }}</p>
                <p>Пингвинов: {{ time.available_penguin_count }}</p>
                
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

  <form class="booking-form" @submit="handleSubmit">
    <div v-if="isReviewMode">
      <template v-if="paymentStatus.loading">
        <h2>Проверка оплаты...</h2>
        <div class="payment-loading">
          <div class="spinner"></div>
          <p>Пожалуйста, подождите, пока мы проверяем статус вашего платежа</p>
        </div>
      </template>

      <template v-else-if="paymentStatus.success === null">
        <h2>Предварительный просмотр заказа</h2>

        <div v-if="sessionDetails && selectedTime">
          <div>Сеанс №{{ sessionDetails.id }}</div>
          <div>Дата: {{ formatDate(sessionDetails.date) }}</div>
          <div>Время: {{ selectedTime.start_time }} - {{ selectedTime.end_time }}</div>
          <div>Взрослые: {{ adults }}</div>
          <div>Дети до 11 лет: {{ children }}</div>
          <div>Пингвины: {{ penguinsCount }}</div>
          <div>Пар коньков: {{ skatesCount }}</div>
          <div>Имя заказчика: {{ userName }}</div>
          <div>Телефон: {{ formatPhoneNumber(phoneNumber) }}</div>
          <div>Промокод: {{ promoCode }}</div>
          <div>Общая сумма заказа: {{ totalCost }} ₽</div>
        </div>

        <p>Правила оплаты:</p>
        <ol>
          <li>Оплата производится онлайн банковской картой.</li>
          <li>При отмене бронирования возврат средств возможен только в течение суток.</li>
          <li>Указанные контактные данные необходимы для связи с вами.</li>
        </ol>

        <button type="button" @click="completeOrder">Оплатить заказ</button>
        <button type="button" @click="cancelReview">Назад</button>
      </template>

      <template v-else-if="paymentStatus.success">
        <h2>Заказ успешно оплачен!</h2>

        <div class="order-success">
          <div>Номер заказа: {{ paymentStatus.order.id }}</div>
          <div>Пин-код: {{ paymentStatus.order.pin }}</div>
          <div>Дата: {{ formatDate(paymentStatus.order.date) }}</div>
          <div>Время: {{ paymentStatus.order.time }}</div>
          <div>Количество человек: {{ paymentStatus.order.people_count }}</div>
          <div>Стоимость: {{ paymentStatus.order.price }} ₽</div>
        </div>

        <button type="button" @click="cancelReview">Вернуться к выбору сеанса</button>
      </template>

      <template v-else>
        <h2>Ошибка оплаты</h2>
        <p>Произошла ошибка при обработке платежа. Пожалуйста, попробуйте еще раз.</p>
        <button type="button" @click="resetPaymentStatus">Попробовать снова</button>
      </template>
    </div>

    <div v-else >
      <div v-if="sessionDetails && selectedTime" class="currentSession">
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
        <label>
          <input type="checkbox" v-model="needPenguins">
          Требуется ли пингвин?
        </label>
      </div>

      <div class="form-group" v-if="showPenguinsInput">
        <label>Необходимое количество пингвинов</label>
        <input type="number" v-model.number="penguinsCount" min="0" :max="children" required>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="needSkates">
          Аренда коньков?
        </label>
      </div>

      <div class="form-group" v-if="showSkatesInput">
        <label>Необходимое количество пар коньков</label>
        <input type="number" v-model.number="skatesCount" min="0" required>
      </div>

      <div class="form-group">
        <label>Ваше имя</label>
        <input type="text" v-model="userName" required>
      </div>

       <div class="form-group">
    <label>Ваш телефон</label>
    <input 
      type="tel" 
      :value="formatPhoneNumber(phoneNumber)"
      @input="handlePhoneInput"
      @blur="handlePhoneBlur"
      placeholder="+7 (___) ___-__-__"
      required
    >
    <div class="error-message" v-if="phoneError">{{ phoneError }}</div>
  </div>

      <div class="form-group">
        <label>Промокод (необязательно)</label>
        <input type="text" v-model="promoCode">
      </div>

      <button type="submit">Оформить заказ</button>
    </div>
  </form>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&subset=latin,cyrillic');

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.filter-container {
  font-family: 'Roboto', sans-serif;
  color: #064594;
  margin: 0 auto;
  padding: 20px 0;
  text-align: center;
  max-width: 500px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #064594;
  border-radius: 4px;
  font-family: inherit;
  color: #064594;
  margin-bottom: 20px;
  width: 100%;
  max-width: 500px;
  background-color: #f5f9ff;
  font-size: 1rem;
}

.session-list {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  width: 100%;
    max-width: 500px;

}

.session-item {
  padding: 10px;
  margin-bottom: 8px;
  background-color: #f5f9ff;
  border: 1px solid #d0e0ff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-item:hover {
  background-color: #e0ecff;
}

.time-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  list-style: none;
  padding-left: 0;
  margin-top: 8px;
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

.time-item:hover {
  background-color: #06459480;
}

.selected-time {
  background-color: #ffffff;
  color: #064594;
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
.booking-form {
  font-family: 'Roboto', sans-serif;
  color: #064594;
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  background: #f5f9ff;
  border: 1px solid #c0d0ff;
  border-radius: 8px;
  box-sizing: border-box;
}

.currentSession {
  margin-bottom: 50px;
}
.form-group {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

input[type="number"],
input[type="text"],
input[type="tel"],
input[type="date"],
select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  box-sizing: border-box;
  max-width: 100%;
}

input[type="checkbox"] {
  margin-right: 8px;
  width: auto;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

button {
  background-color: #064594;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 25px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  margin: 20px 0;
  width: 100%;
  max-width: 300px;
  transition: background-color 0.2s;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

button:hover {
  background-color: #043a7a;
}

h2 {
  color: #064594;
  margin-bottom: 20px;
  text-align: center;
}

.order-success {
  background-color: #f0fff0;
  border: 1px solid #a0d8a0;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.order-success div {
  margin-bottom: 8px;
  font-size: 1.1em;
}

.order-success div:first-child {
  font-weight: bold;
  font-size: 1.2em;
}

.payment-loading {
  text-align: center;
  padding: 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 20px;
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

.date-picker {
  margin: 15px 0;
  width: 100%;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.date-picker label {
  display: block;
  margin-bottom: 5px;
  text-align: left;
}

.date-picker input {
  width: 100%;
}

.loading-message,
.error-message,
.no-sessions {
  margin: 15px 0;
  padding: 10px;
  border-radius: 4px;
}

.loading-message {
  color: #064594;
}

.error-message {
  color: #d32f2f;
  background-color: #ffebee;
}

.no-sessions {
  color: #064594;
  font-style: italic;
}

/* Адаптивные стили */
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .booking-form {
    padding: 15px;
  }
  
  .filter-select,
  .date-picker {
    max-width: 100%;
  }
  
  button {
    max-width: 100%;
  }
  
  .session-list {
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  .form-group {
    margin-bottom: 10px;
  }
  
  input[type="number"],
  input[type="text"],
  input[type="tel"],
  input[type="date"] {
    padding: 8px;
  }
  
  .time-item {
    padding: 6px;
    font-size: 0.9em;
  }
  
  .availability {
    font-size: 0.75em;
  }
}

.checkbox-container {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  width: 100%;
}

.checkbox-container input[type="checkbox"] {
  flex: 0 0 auto;
  margin-right: 10px;
}

.checkbox-container label {
  flex: 1 1 auto;
  margin-bottom: 0;
}

.dynamic-content {
  transition: all 0.3s ease;
  overflow: hidden;
}

.form-group.dynamic {
  margin-top: -1px;
  border-top: 1px solid transparent;
  transition: all 0.3s ease;
}
</style> -->