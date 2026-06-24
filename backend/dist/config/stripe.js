import Stripe from 'stripe';
if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not defined in .env');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log('Stripe initialized');
export default stripe;
