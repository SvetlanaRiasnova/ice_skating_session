<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getSessionDetails, getOrderPrice, createOrder } from '../services/api';

const sessionId = ref(null);
const sessionDetails = ref(null);
const adults = ref(1);
const children = ref(0);
const needPenguins = ref(false);
const penguinsCount = ref(0);
const needSkates = ref(false);
const skatesCount = ref(0);
const userName = ref('');
const phoneNumber = ref('');
const promoCode = ref('');

const showPenguinsNeeds = computed(() => children.value > 0);
const showPenguinsInput = computed(() => needPenguins.value);
const showSkatesInput = computed(() => needSkates.value);

const totalCost = ref(0);
const isReviewMode = ref(false); // Режим предварительного просмотра

onMounted(async () => {
  if (sessionId.value) {
    sessionDetails.value = await getSessionDetails(sessionId.value);
  }
});

const handleSubmit = async () => {
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

    // Переход в режим предварительного просмотра заказа
    isReviewMode.value = true;
  } catch (err) {
    console.error(err);
  }
};

const completeOrder = async () => {
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
    const orderResult = await createOrder(payload);
    alert('Заказ успешно оформлен.');
  } catch (err) {
    console.error(err);
  }
};

const cancelReview = () => {
  isReviewMode.value = false;
};
</script>

<template>
  <div class="booking-form">
    <div v-if="isReviewMode">
      <h2>Предварительный просмотр заказа</h2>
      
      <div>Сеанс №{{ sessionDetails ? sessionDetails.id : '' }}</div>
      <div>Дата и время: {{ sessionDetails ? sessionDetails.date : '' }} - {{ sessionDetails ? sessionDetails.time : '' }}</div>
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

      <button @click="completeOrder">Оплатить заказ</button>
      <button @click="cancelReview">Назад</button>
    </div>

    <div v-else>
      <div v-if="sessionDetails">
        <strong>Сеанс №{{ sessionDetails.id }}</strong><br>
        Дата и время: {{ sessionDetails.date }} - {{ sessionDetails.time }}<br>
      </div>

      <div>
        <label>Взрослые (от 11 лет и старше)</label>
        <input type="number" v-model.number="adults" required>
      </div>

      <div>
        <label>Дети до 11 лет</label>
        <input type="number" v-model.number="children" required>
      </div>

      <div v-if="showPenguinsNeeds">
        <label>Требуется ли пингвин?</label>
        <input type="checkbox" v-model="needPenguins">
      </div>

      <div v-if="showPenguinsInput">
        <label>Необходимое количество пингвинов</label>
        <input type="number" v-model.number="penguinsCount" required>
      </div>

      <div>
        <label>Аренда коньков?</label>
        <input type="checkbox" v-model="needSkates">
      </div>

      <div v-if="showSkatesInput">
        <label>Необходимое количество пар коньков</label>
        <input type="number" v-model.number="skatesCount" required>
      </div>

      <div>
        <label>Ваше имя</label>
        <input type="text" v-model="userName" required>
      </div>

      <div>
        <label>Ваш телефон</label>
        <input type="tel" v-model="phoneNumber" required>
      </div>

      <div>
        <label>Промокод (необязательно)</label>
        <input type="text" v-model="promoCode">
      </div>

      <button @click="handleSubmit">Оформить заказ</button>
    </div>
  </div>
</template>

<style scoped>
.booking-form {
  text-align: left;
  padding: 2rem;
  display: flex;
  flex-direction: column;
}

.booking-form input {
  width: 100%;
  box-sizing: border-box;
}
</style>