import { useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Text,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/src/lib/api";

const { width: SCREEN_W } = Dimensions.get("window");
const GALLERY_H = 420;

type Props = {
  photos: string[];
  width?: number;
  height?: number;
  topInset?: number;
};

export default function ProfilePhotoGallery({
  photos,
  width = SCREEN_W,
  height = GALLERY_H,
  topInset = 0,
}: Props) {
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(0);
  const total = photos.length;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(Math.max(i, 0), total - 1));
  };

  if (total === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No photos yet</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }} testID="profile-photo-gallery">
      <FlatList
        ref={listRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={total > 1}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height }}
            resizeMode="cover"
          />
        )}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.65)"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {total > 1 && (
        <View style={[styles.dots, { top: topInset + 18 }]} pointerEvents="none">
          {photos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      )}
      {total > 1 && (
        <View style={[styles.counter, { top: topInset + 18 }]} pointerEvents="none">
          <Text style={styles.counterText}>
            {index + 1} / {total}
          </Text>
        </View>
      )}
    </View>
  );
}

export { GALLERY_H };

const styles = StyleSheet.create({
  empty: {
    backgroundColor: COLORS.chipBg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: COLORS.textSecondary, fontWeight: "600" },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    width: 20,
    backgroundColor: "#fff",
  },
  counter: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  counterText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
