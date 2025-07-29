<script setup lang="ts">
import BookingForm from '../components/BookingForm.vue';
</script>

<template>
  <main class="container">
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
  border: 2px solid #064594;
  border-radius: 25px;
}
</style>