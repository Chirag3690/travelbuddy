import { View, StyleSheet } from "react-native";
import { useTheme } from "@/src/lib/theme";
import VinciAtlantisAura from "@/src/components/vinci/VinciAtlantisAura";
import VinciVectorSketches from "@/src/components/vinci/VinciVectorSketches";

type Props = {
  layout?: "screen" | "login";
};

/** Atlantis × Da Vinci: bioluminescent aura + floating vector studies */
export default function VinciBackdrop({ layout = "screen" }: Props) {
  const { colors, isVinci, isNight } = useTheme();
  if (!isVinci) return null;

  const grid = isNight ? colors.border : `${colors.primary}28`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VinciAtlantisAura />
      <VinciVectorSketches layout={layout === "login" ? "login" : "screen"} />

      {/* Subtle notebook grid — stays behind vectors */}
      {[0.14, 0.32, 0.5, 0.68, 0.86].map((top) => (
        <View
          key={`h-${top}`}
          style={[styles.line, styles.hLine, { top: `${top * 100}%`, backgroundColor: grid }]}
        />
      ))}
      {[0.1, 0.28, 0.5, 0.72, 0.9].map((left) => (
        <View
          key={`v-${left}`}
          style={[styles.line, styles.vLine, { left: `${left * 100}%`, backgroundColor: grid }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: "absolute", opacity: 0.22 },
  hLine: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
  vLine: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
});
