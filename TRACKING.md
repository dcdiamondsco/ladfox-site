# LADFOX tracking inventory

Google tag `AW-18173399172` is loaded directly in the page head. No consent-management implementation or approved cookie/privacy policy was found, so consent gating remains an owner/legal decision. No form field values, email addresses, phone numbers or uploaded file data are intentionally sent in the events below.

| Event | Exact trigger |
| --- | --- |
| `quick_form_start` | First focus/input interaction with the homepage quick-enquiry form. |
| `enquiry_option_selected` | Homepage enquiry route radio changes; sends only the selected route label. |
| `quick_form_submit_success` | Homepage Netlify form request returns an HTTP success response. |
| `quick_form_submit_error` | Homepage validation fails or the Netlify request returns/fails without success. |
| `whatsapp_click` | Homepage WhatsApp link is clicked. |
| `ring_designer_click` | Homepage primary ring-designer link is clicked. |
| `recent_commissions_click` | Homepage recent-work link is clicked. |
| `callback_form_started` | First interaction with the consultation callback form. |
| `direct_telephone_clicked` | Consultation telephone link is clicked. |
| `whatsapp_clicked` | Consultation WhatsApp link is clicked. |
| `callback_request_submitted` | Consultation form request returns an HTTP success response. |
| `callback_submission_error` | Consultation validation or submission fails. |
| `cta_click` | Ring designer CTA click; this is an engagement event, not a lead. |
| `generate_lead` | Ring designer form request returns an HTTP success response. |
| `begin_checkout` | Classic-collection checkout button starts the server-side checkout request. |
| `purchase` | Checkout-success page receives a paid, complete, server-verified Stripe session whose currency, amount and product metadata match. A localStorage key suppresses repeats in the same browser. |
