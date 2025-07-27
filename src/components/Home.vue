<!-- src/views/Home.vue -->
<script setup lang="ts">
import SessionsFilter from '../components/SessionFilter.vue';
import BookingForm from '../components/BookingForm.vue';
</script>

<template>
  <main class="container">
    <SessionsFilter />
    <BookingForm />
  </main>
</template>

<style scoped>
.container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>