// With Stripe Payment Link you don't need server-side PRICE_ID code.
// Just redirect to your payment link.

const path = require('path');
const express = require('express');
const app = express();
const siteRoot = __dirname;

app.use(express.json());
app.use(express.static(siteRoot));

app.get('/', (req, res) => {
  res.sendFile(path.join(siteRoot, 'index.html'));
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { ringSize } = req.body;

    // Instead of creating a Checkout Session, simply return your Payment Link
    const paymentLink = 'https://buy.stripe.com/cNi4gz7SU4Gtd0v7XJcs80s';

    // Optionally include metadata if you want to store ring size elsewhere
    res.json({ url: paymentLink });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(4242, () => console.log('Server running on http://localhost:4242'));
