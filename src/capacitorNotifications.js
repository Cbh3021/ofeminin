import { LocalNotifications } from "@capacitor/local-notifications";

// IDs fixes pour pouvoir annuler/replanifier proprement à chaque changement
// de paramètres, sans laisser d'anciennes notifications obsolètes.
const NOTIF_IDS = {
  reglesBientot: 1001,
  fenetreFertile: 1002,
  ovulation: 1003,
};

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function atNineAM(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Calcule la date de début des prochaines règles à partir de la DDR et de
// la longueur du cycle, en avançant cycle par cycle jusqu'à trouver une
// date dans le futur.
function nextPeriodDate(ddr, longueurCycle, from = new Date()) {
  let date = new Date(ddr);
  while (date <= from) {
    date = addDays(date, longueurCycle);
  }
  return date;
}

export async function requestNotificationPermission() {
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

// Annule les rappels de cycle existants (pas les autres notifications de
// l'app, s'il y en a un jour d'autres types).
export async function cancelCycleNotifications() {
  await LocalNotifications.cancel({
    notifications: Object.values(NOTIF_IDS).map((id) => ({ id })),
  });
}

// Replanifie les 3 rappels pour le cycle en cours, à partir des paramètres
// actuels. À appeler après chaque modification de la DDR/durée/longueur,
// et une fois au démarrage de l'app.
export async function scheduleCycleNotifications({ ddr, longueurCycle }) {
  const granted = await requestNotificationPermission();
  if (!granted) return { scheduled: false, reason: "Permission refusée" };

  await cancelCycleNotifications();

  const periodDate = nextPeriodDate(ddr, longueurCycle);
  const ovulationDate = addDays(periodDate, -14);
  const fertileStartDate = addDays(ovulationDate, -5);

  const notifications = [
    {
      id: NOTIF_IDS.reglesBientot,
      title: "Tes règles arrivent bientôt",
      body: "Tes prochaines règles sont prévues dans 2 jours.",
      schedule: { at: atNineAM(addDays(periodDate, -2)) },
    },
    {
      id: NOTIF_IDS.fenetreFertile,
      title: "Début de ta période de fertilité",
      body: "Ta fenêtre de fertilité commence aujourd'hui.",
      schedule: { at: atNineAM(fertileStartDate) },
    },
    {
      id: NOTIF_IDS.ovulation,
      title: "Pic de fertilité estimé",
      body: "Ton ovulation est estimée aujourd'hui.",
      schedule: { at: atNineAM(ovulationDate) },
    },
  ].filter((n) => n.schedule.at > new Date()); // ignore les dates déjà passées

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }

  return { scheduled: true, periodDate, ovulationDate, fertileStartDate };
}
