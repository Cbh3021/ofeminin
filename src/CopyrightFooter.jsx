// Petite mention de copyright, pensée pour rester lisible en toutes
// circonstances sur Android (WebView Capacitor) :
// - z-index élevé pour ne jamais passer sous un autre écran
// - pointer-events-none pour ne jamais intercepter un tap destiné à l'UI en dessous
// - padding basé sur env(safe-area-inset-bottom) pour ne pas être mangée par la
//   barre de navigation gestuelle Android/iOS
//
// Un seul et même composant pour toute l'app, avec deux modes :
// - fixed (par défaut) : pastille fixe collée en bas de l'écran. À utiliser sur
//   les écrans SANS barre de navigation propre (connexion, écrans de chargement).
// - inline (fixed={false}) : simple ligne de texte, sans position fixed. À
//   utiliser imbriqué DANS la barre de navigation basse fixe de App.jsx, pour
//   ne jamais empiler deux éléments "fixed" au même endroit.
export default function CopyrightFooter({ fixed = true }) {
  const text = "© Dr Hédi Belhoula — 2026";

  if (!fixed) {
    return <p className="text-center text-[9px] text-[#94A3B8] mt-1">{text}</p>;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1"
      aria-hidden="true"
    >
      <span className="text-[10px] text-[#94A3B8]/90 bg-[#FBF5F7]/70 px-2 rounded-full">
        {text}
      </span>
    </div>
  );
}
