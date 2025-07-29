<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getSessions } from '../services/api';

interface Session {
  id: number;
  date: string;
  time: string;
}

type FilterType = '' | 'nearest' | 'weekend' | 'custom';


const sessions = ref<Session[]>([]);
const filterType = ref<FilterType>('');


onMounted(async () => {
  await loadSessions();
});


async function loadSessions() {
  try {
    const res = await getSessions(filterType.value);
    sessions.value = res;
  } catch (error) {
    console.error('Ошибка загрузки сеансов:', error);
  }
}


const chooseSession = (sessionId: number) => {
  // 
  console.log( sessionId);
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
        @click="goToSession(session.id)"
        class="session-item"
      >
        {{ session.date }} - {{ session.time }}
      </li>
    </ul>

    <p v-else class="no-sessions">Расписания на указанную дату пока нет.</p>
  </div>
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
</style>