# Progressio – installazione

## 1. Pubblicare l'app (GitHub Pages, gratis)
1. Crea un repository **pubblico** su GitHub (per esempio `palestra`).
2. *Add file → Upload files*: carica **tutto** il contenuto di questa cartella (comprese `js`, `icons`, `vendor`). *Commit changes*.
3. *Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save*.
4. Dopo un paio di minuti l'app è su `https://TUO-UTENTE.github.io/palestra/`.
5. Sul telefono aprila con Chrome → menu ⋮ → **Installa app**.

Non cambiare poi nome al repository: i dati sul telefono sono legati all'indirizzo.

## 2. Sincronizzazione OneDrive (facoltativa, gratis)
Serve registrare l'app su Microsoft Entra una volta sola. Da giugno 2024 Microsoft richiede che la registrazione stia in una "directory" (tenant): un account Microsoft personale da solo non basta più.
1. Vai su https://entra.microsoft.com con un account che ha una directory (per esempio creando un account Azure gratuito con il tuo account Microsoft personale).
2. *Identità → Applicazioni → Registrazioni app → Nuova registrazione*.
   - Nome: `Progressio` (sarà anche il nome della cartella in OneDrive › App).
   - Tipi di account supportati: **Solo account Microsoft personali**.
   - URI di reindirizzamento: piattaforma **Applicazione a pagina singola (SPA)**, indirizzo `https://TUO-UTENTE.github.io/palestra/` (con la barra finale).
3. Copia l'**ID applicazione (client)** e incollalo in `config.js` alla voce `clientId`. Ricarica `config.js` su GitHub.
4. Nell'app: *Gestisci → Impostazioni → Accedi con Microsoft*. Al primo accesso accetta il permesso "accesso alla cartella dell'app in OneDrive".

L'app vede solo la propria cartella `OneDrive/App/Progressio`, non il resto della tua OneDrive.

## 3. Contatore anonimo (facoltativo, gratis)
1. Registrati su https://www.goatcounter.com e scegli un codice (es. `progressio`).
2. Scrivi il codice in `config.js` alla voce `goatcounter` e ricarica il file su GitHub.
3. Le statistiche (aperture, visitatori unici, nessun dato personale) sono su `https://CODICE.goatcounter.com`.

## Aggiornamenti
Per installare una nuova versione ricarica i file su GitHub sostituendo quelli vecchi. L'app si aggiorna da sola alla seconda apertura. I dati restano.
