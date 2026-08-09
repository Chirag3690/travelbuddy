import { useState } from "react";
import { View, Image, StyleSheet, Pressable } from "react-native";
import { COLORS } from "@/src/lib/api";

type Props = {
  photos: string[];
  fallback?: string;
};

export default function PhotoCarousel({ photos, fallback }: Props) {
  const [idx, setIdx] = useState(0);
  const list = photos && photos.length ? photos : (fallback ? [fallback] : []);
  const total = list.length;

  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  if (total === 0) {
    return <View style={[StyleSheet.absoluteFill as any, { backgroundColor: COLORS.chipBg }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFill as any}>
      <Image
        source={{ uri: list[idx] }}
        style={StyleSheet.absoluteFill as any}
        // @ts-ignore RN web prop
        resizeMode="cover"
      />
      {total > 1 && (
        <>
          {/* Tap zones */}
          <View style={styles.zoneRow} pointerEvents="box-none">
            <Pressable style={styles.zone} onPress={prev} testID="carousel-prev" />
            <Pressable style={styles.zone} onPress={next} testID="carousel-next" />
          </View>
          {/* Progress segments */}
          <View style={styles.progressRow} pointerEvents="none">
            {list.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  { backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.4)" },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zoneRow: { flex: 1, flexDirection: "row" },
  zone: { flex: 1 },
  progressRow: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
});
