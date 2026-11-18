// Progressio - configurazione. È l'unico file da modificare.
window.DP_CONFIG = {
  // Sincronizzazione OneDrive: incolla tra gli apici l'"ID applicazione (client)" dell'app
  // registrata su Microsoft Entra (vedi la guida). Lasciato vuoto, i dati restano solo sul telefono.
  clientId: '',
  // Account personali Microsoft (outlook.com, hotmail.com, live.com): lascia 'consumers'.
  authority: 'https://login.microsoftonline.com/consumers',
  // Contatore anonimo delle aperture (GoatCounter). Scrivi solo il codice del tuo sito,
  // per esempio 'progressio' se il tuo indirizzo è progressio.goatcounter.com.
  // Lasciato vuoto, l'app non conta nulla.
  goatcounter: ''
};
