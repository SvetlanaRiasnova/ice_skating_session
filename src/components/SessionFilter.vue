<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getSessions } from '../services/api';

const sessions = ref([]);
const filterType = ref('');

onMounted(async () => {
  await loadSessions();
});

async function loadSessions() {
  try {
    const res = await getSessions(filterType.value);
    sessions.value = res;
  } catch (err) {
    console.error(err);
  }
}

const goToSession = (sessionId) => {
  // Перенаправляем на просмотр деталей сеанса
};
</script>

<template>
  <div class="filter-container">
    <select v-model="filterType" @change="loadSessions">
      <option value="" disabled>Выберите фильтр</option>
      <option value="nearest">Ближайшие три дня</option>
      <option value="weekend">Ближайшие выходные</option>
      <option value="custom">Определённая дата</option>
    </select>

    <ul v-if="sessions.length > 0">
      <li v-for="session in sessions" :key="session.id" @click="goToSession(session.id)">
        {{ session.date }} - {{ session.time }}
      </li>
    </ul>

    <p v-else>Расписания на указанную дату пока нет.</p>
  </div>
</template>

<style scoped>
.filter-container {
  text-align: center;
  padding: 2rem;
}
</style>