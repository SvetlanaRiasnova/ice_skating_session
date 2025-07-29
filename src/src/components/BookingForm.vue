<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getSessionDetails, getOrderPrice, createOrder, getSessions } from '../services/api';

interface Session {
  id: number;
  date: string;
  time: string;
}
interface SessionDetails {
  id: number;
  date: string;
  time: string;
}

type FilterType = '' | 'nearest' | 'weekend' | 'custom';

const sessions = ref<Session[]>([]);
const filterType = ref<FilterType>('');
const sessionId = ref<number | null>(null);
const sessionDetails = ref<SessionDetails | null>(null);
const adults = ref<number>(1);
const children = ref<number>(0);
const needPenguins = ref<boolean>(false);
const penguinsCount = ref<number>(0);
const needSkates = ref<boolean>(false);
const skatesCount = ref<number>(0);
const userName = ref<string>('');
const phoneNumber = ref<string>('');
const promoCode = ref<string>('');
const totalCost = ref<number>(0);
const isReviewMode = ref<boolean>(false);

const showPenguinsNeeds = computed(() => children.value > 0);
const showPenguinsInput = computed(() => needPenguins.value);
const showSkatesInput = computed(() => needSkates.value);

// onMounted(async () => {
//   if (sessionId.value) {
//     try {
//       sessionDetails.value = await getSessionDetails(sessionId.value);
//     } catch (error) {
//       console.error('Ошибка загрузки деталей сеанса:', error);
//     }
//   }
// });

async function loadSessions() {
  try {
    const res = await getSessions(filterType.value);
    sessions.value = res;
  } catch (error) {
    console.error('Ошибка загрузки сеансов:', error);
  }
}


const chooseSession = (e) => {
  sessionId.value = e.target.sessionId;
  console.log( sessionId);
};

const handleSubmit = async (event: Event) => {
  event.preventDefault();
  
  if (!sessionId.value) return;

  const payload = {
    session: sessionId.value,
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
  } catch (error) {
    console.error('Ошибка расчета стоимости:', error);
  }
};


const completeOrder = async () => {
  if (!sessionId.value) return;

  const payload = {
    session: sessionId.value,
    adult_count: adults.value,
    child_count: children.value,
    penguin_count: penguinsCount.value,
    skates_count: skatesCount.value,
    user_name: userName.value,
    user_phone: phoneNumber.value,
    promo_code: promoCode.value
  };

  try {
    await createOrder(payload);
    alert('Заказ успешно оформлен.');
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
  }
};

const cancelReview = () => {
  isReviewMode.value = false;
};
</script>

<template>
   <div class="filter-container">
    <select 
      v-model="filterType" 
      @change="loadSessions"
      class="filter-select"
    >
      <option value="" disabled>Выберите дату</option>
      <option value="nearest">Ближайшие три дня</option>
      <option value="weekend">Ближайшие выходные</option>
      <option value="custom">Определённая дата</option>
    </select>

    <ul v-if="sessions.length > 0" class="session-list">
      <li 
        v-for="session in sessions" 
        :key="session.id" 
        @click="chooseSession(session.id)"
        class="session-item"
      >
        {{ session.date }} - {{ session.time }}
      </li>
    </ul>

    <p v-else class="no-sessions">Расписания на указанную дату пока нет.</p>
  </div>
  <form class="booking-form" @submit="handleSubmit">
    <div v-if="isReviewMode">
      <h2>Предварительный просмотр заказа</h2>
      
      <div>Сеанс №{{ sessionDetails?.id }}</div>
      <div>Дата и время: {{ sessionDetails?.date }} - {{ sessionDetails?.time }}</div>
      <div>Взрослые: {{ adults }}</div>
      <div>Дети до 11 лет: {{ children }}</div>
      <div>Пингвины: {{ penguinsCount }}</div>
      <div>Пар коньков: {{ skatesCount }}</div>
      <div>Имя заказчика: {{ userName }}</div>
      <div>Телефон: {{ phoneNumber }}</div>
      <div>Промокод: {{ promoCode }}</div>
      <div>Общая сумма заказа: {{ totalCost }}</div>

      <p>Правила оплаты:</p>
      <ol>
        <li>Оплата производится онлайн банковской картой.</li>
        <li>При отмене бронирования возврат средств возможен только в течение суток.</li>
        <li>Указанные контактные данные необходимы для связи с вами.</li>
      </ol>

      <button type="button" @click="completeOrder">Оплатить заказ</button>
      <button type="button" @click="cancelReview">Назад</button>
    </div>

    <div v-else>
      <div v-if="sessionDetails">
        <strong>Сеанс №{{ sessionDetails.id }}</strong><br>
        Дата и время: {{ sessionDetails.date }} - {{ sessionDetails.time }}<br>
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
        <input type="tel" v-model="phoneNumber" required>
      </div>

      <div class="form-group">
        <label>Промокод (необязательно)</label>
        <input type="text" v-model="promoCode">
      </div>

      <button type="submit" >Оформить заказ</button>
    </div>
  </form>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&subset=latin,cyrillic');
.filter-container {
  font-family: 'Roboto', sans-serif;
  color: #064594;
  /* max-width: 600px; */
  margin: 0 auto;
  padding: 20px 0;
  text-align: center;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #064594;
  border-radius: 4px;
  font-family: inherit;
  color: #064594;
  margin-bottom: 20px;
}

.session-list {
  list-style: none;
  padding: 0;
}

.session-item {
  padding: 10px;
  margin-bottom: 8px;
  background-color: #f5f9ff;
  border: 1px solid #d0e0ff;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.session-item:hover {
  background-color: #e0ecff;
}

.no-sessions {
  color: #064594;
  font-style: italic;
}
.booking-form {
  font-family: 'Roboto', sans-serif;
  color: #064594;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 0;
  text-align: left;
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
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  box-sizing: border-box;
}

input[type="checkbox"] {
  margin-right: 8px;
}

button {
  background-color: #064594;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 25px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  margin-right: 10px;
  margin-top: 20px;
  width: 100%;
}

button:hover {
  background-color: #043a7a;
}

h2 {
  color: #064594;
  margin-bottom: 20px;
}
</style>