<!-- components/PromotionModal.vue -->
<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <button class="close-button" @click="closeModal">×</button>
      
      <h2>{{ promotion.title }}</h2>
      
      <img 
        v-if="promotion.image" 
        :src="promotion.image" 
        :alt="promotion.title"
        class="promotion-image"
      >
      
      <div class="promotion-dates">
        Действует с {{ promotion.start_date }} по {{ promotion.end_date }}
      </div>
      
      <div class="promotion-description">
        {{ promotion.description }}
      </div>
      
      <div class="promotion-discount">
        Скидка: {{ promotion.sum }} ₽
      </div>
      
      <button 
        class="add-button"
        @click="togglePromotion"
      >
        {{ isAdded ? 'Удалить из заказа' : 'Добавить к заказу' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps({
  promotion: {
    type: Object,
    required: true
  },
  selectedPromotions: {
    type: Array as () => number[],
    required: true
  }
});

const emit = defineEmits(['update:selectedPromotions', 'close']);

const isOpen = ref(true);

const isAdded = computed(() => {
  return props.selectedPromotions.includes(props.promotion.id);
});

const togglePromotion = () => {
  const newPromotions = [...props.selectedPromotions];
  const index = newPromotions.indexOf(props.promotion.id);
  
  if (index > -1) {
    newPromotions.splice(index, 1);
  } else {
    newPromotions.push(props.promotion.id);
  }
  
  emit('update:selectedPromotions', newPromotions);
  closeModal();
};

const closeModal = () => {
  isOpen.value = false;
  emit('close');
};
</script>

<style scoped>
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
  font-size: 1em;
}

.add-button:hover {
  background-color: #043a7a;
}

@media (max-width: 480px) {
  .modal-content {
    width: 95%;
    padding: 15px;
  }
}
</style>