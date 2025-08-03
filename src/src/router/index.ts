import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes : Array<RouteRecordRaw> = [
    {
        path: '/',
        name: 'home', 
        component: () => import('../components/BookingForm.vue') 
    },
{
  path: '/privacy-policy',
  name: 'privacyPolicy', 
  component: () => import('../components/PrivacyPolicyModal.vue') 
}
]

const router = createRouter(
    {
        history: createWebHistory(),
        routes
    }
)

export default router;