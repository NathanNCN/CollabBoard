import { Palette as PaletteIcon } from "lucide-react";
export default function Palette({ showColourChange, setShowColourChange }: { showColourChange: boolean, setShowColourChange: (showColourChange: boolean) => void }) {
    return (
        <button
          onClick={() => setShowColourChange(!showColourChange)}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            showColourChange
              ? "bg-pink-100 text-pink-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-pink-50 hover:text-pink-500"
          }`}
          title="Show Colour Change"
        >
          <PaletteIcon size={22} />
        </button>
    );
}