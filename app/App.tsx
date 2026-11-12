/*
Как проходит работа с макетом
1. PicPacApp получает фотографии из галереи и хранит их вместе с ProductConfig.
2. При выборе формата makeConfig создаёт места для фото, а syncSlots заполняет их.
3. ProductPreview показывает объёмное изделие по этим же данным.
   Обложка, развороты книги и обе стороны открытки рисуются функцией surface.
4. PanResponder меняет только углы обзора. productPlane поворачивает шесть
   сторон изделия и включает перспективу в одну матрицу. Поворот за 90 градусов
   показывает оборот. Нажатие открывает галерею или текст, один палец вращает
   изделие с инерцией, два пальца меняют масштаб.
5. Параметры печати раскрываются по нажатию. Изменения сразу попадают в превью,
   расчёт цены и существующий экран оформления заказа.
Весь код интерфейса, каталог и демонстрационные данные находятся в этом файле.
*/
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
// ——— Типы ———
type BookTemplate = {
  id: string;
  name: string;
  description: string;
  /** overlay — подпись поверх фото, band — подпись на цветной полосе под фото */
  titleStyle: "overlay" | "band";
};

type MockOrder = {
  id: string;
  title: string;
  scenario: string;
  status: string;
  statusIndex: number;
  total: number;
  previewUri: string;
  date: string;
  items: string;
};

type ScenarioCard = {
  id: string;
  title: string;
  subtitle: string;
  productHint: "print" | "photobook" | "gift";
  cover: string;
};

type PrintFormat = {
  id: string;
  label: string;
  pricePer: number;
  ratio: number;
};
type BookLine = {
  id: string;
  name: string;
  desc: string;
  formats: string[];
  basePrice: number;
};
type PosterSize = { id: string; label: string; price: number };

// ——— Изображения для обложек сценариев и превью заказов ———
const COVER_URLS: string[] = [
  "https://images.unsplash.com/photo-1527529482834-4699949fddd0?w=600",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600",
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=600",
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600",
  "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=600",
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600",
];

// ——— Сценарии на главной ———
const SCENARIOS: ScenarioCard[] = [
  {
    id: "georgia",
    title: "Поездка в Грузию",
    subtitle: "Фотокнига из отпуска",
    productHint: "photobook",
    cover: COVER_URLS[4],
  },
  {
    id: "baby",
    title: "Первый год малыша",
    subtitle: "Нежный альбом",
    productHint: "photobook",
    cover: COVER_URLS[1],
  },
  {
    id: "archive",
    title: "Семейный архив",
    subtitle: "Классическая печать",
    productHint: "print",
    cover: COVER_URLS[5],
  },
  {
    id: "gift",
    title: "Подарок маме",
    subtitle: "Открытка с фото",
    productHint: "gift",
    cover: COVER_URLS[2],
  },
];

// ——— Фотокнига ———
const BOOK_TEMPLATES: BookTemplate[] = [
  {
    id: "warm-minimal",
    name: "Тёплый минимализм",
    description: "Подпись поверх фото",
    titleStyle: "overlay",
  },
  {
    id: "travel-story",
    name: "История путешествия",
    description: "Подпись поверх фото",
    titleStyle: "overlay",
  },
  {
    id: "family-classic",
    name: "Семейная классика",
    description: "Подпись на цветной полосе",
    titleStyle: "band",
  },
  {
    id: "baby-soft",
    name: "Нежность",
    description: "Подпись на цветной полосе",
    titleStyle: "band",
  },
  {
    id: "premium-spread",
    name: "Премиум",
    description: "Подпись поверх фото",
    titleStyle: "overlay",
  },
];

const BOOK_LINES: BookLine[] = [
  {
    id: "lite",
    name: "Lite",
    desc: "Твёрдая обложка, гибкие страницы, до 160 стр.",
    formats: ["20×20", "21×30", "25×25"],
    basePrice: 49.9,
  },
  {
    id: "classic",
    name: "Classic",
    desc: "Плотные страницы, раскрытие 180°, до 60 стр.",
    formats: ["20×20", "21×30"],
    basePrice: 69.9,
  },
  {
    id: "premium",
    name: "Premium",
    desc: "Матовая бумага, плотные развороты, твёрдая обложка",
    formats: ["20×20", "21×30", "25×25", "30×20", "30×30"],
    basePrice: 99.9,
  },
];

const COVER_COLORS = [
  { id: "cream", color: "#F5E6D3", label: "Кремовый" },
  { id: "terracotta", color: "#C97B63", label: "Терракота" },
  { id: "sage", color: "#8FA68E", label: "Шалфей" },
  { id: "charcoal", color: "#3D3A36", label: "Графит" },
  { id: "ocean", color: "#5B7C8C", label: "Океан" },
];

type SceneSettings = {
  backgroundColor: string;
  lightPosition: { x: number; y: number };
  lightBrightness: number;
  filter: "none" | "warm" | "cool" | "rose";
};

const SCENE_BACKGROUNDS = [
  { name: "Светлый", color: "#EFF2EC" },
  { name: "Белый", color: "#FFFFFF" },
  { name: "Бежевый", color: "#E8DDD0" },
  { name: "Голубой", color: "#DCE8EF" },
  { name: "Тёмный", color: "#242A30" },
];

const SCENE_FILTERS: {
  id: SceneSettings["filter"];
  label: string;
  tint: string;
}[] = [
  { id: "none", label: "Без фильтра", tint: "transparent" },
  { id: "warm", label: "Тёплый", tint: "rgba(237,164,74,0.18)" },
  { id: "cool", label: "Холодный", tint: "rgba(83,153,215,0.17)" },
  { id: "rose", label: "Розовый", tint: "rgba(217,112,142,0.16)" },
];

// ——— Открытка ———
const POSTCARD_TEMPLATES = [
  { id: "classic", name: "Классика", accent: "#2D6553", tint: "#FFF6EE" },
  { id: "botanical", name: "Ботаника", accent: "#6B8F71", tint: "#F1F6F1" },
  { id: "minimal", name: "Минимум", accent: "#1F1D1B", tint: "#F5F3F0" },
];

// ——— Печать ———
const PRINT_FORMATS: PrintFormat[] = [
  { id: "10x15", label: "10×15 см", pricePer: 0.65, ratio: 2 / 3 },
  { id: "15x20", label: "15×20 см", pricePer: 2.4, ratio: 3 / 4 },
  { id: "20x30", label: "20×30 см", pricePer: 5.9, ratio: 2 / 3 },
];

// ——— Постер ———
const POSTER_SIZES: PosterSize[] = [
  { id: "30x40", label: "30×40 см", price: 24.9 },
  { id: "40x60", label: "40×60 см", price: 39.9 },
  { id: "50x70", label: "50×70 см", price: 54.9 },
];

// ——— Заказы ———
const INITIAL_ORDERS: MockOrder[] = [
  {
    id: "ord-1042",
    title: "Фотокнига Lite 25×25",
    scenario: "Поездка в Грузию",
    status: "printing",
    statusIndex: 1,
    total: 69.3,
    previewUri: COVER_URLS[2],
    date: "28 окт 2026",
    items: "12 разворотов · шаблон «История путешествия»",
  },
  {
    id: "ord-1031",
    title: "Фотопечать 10×15",
    scenario: "Семейный архив",
    status: "delivered",
    statusIndex: 4,
    total: 12.35,
    previewUri: COVER_URLS[5],
    date: "12 сен 2026",
    items: "19 отпечатков · матовая бумага",
  },
  {
    id: "ord-1028",
    title: "Открытка",
    scenario: "Подарок маме",
    status: "ready",
    statusIndex: 2,
    total: 23.4,
    previewUri: COVER_URLS[14],
    date: "5 сен 2026",
    items: "5 открыток · стиль «Ботаника»",
  },
];

const ORDER_STATUSES: string[] = [
  "Принят",
  "В печати",
  "Готов",
  "В пути",
  "Доставлен",
];

// ——— Доставка и оплата ———
const DELIVERY_OPTIONS = [
  { id: "courier", label: "Курьер по Минску", eta: "1–2 дня", price: 5.0 },
  { id: "belpost", label: "Белпочта", eta: "3–5 дней", price: 3.5 },
  { id: "ems", label: "EMS", eta: "2–3 дня", price: 12.0 },
];

const PAYMENT_OPTIONS = [
  { id: "card", label: "Банковская карта" },
  { id: "erip", label: "ЕРИП" },
  { id: "cash", label: "При получении" },
];

const PROMO_CODE = "PICPAC10";
const PROMO_DISCOUNT = 0.1;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ═══════════════════════════ Тема ═══════════════════════════
const colors = {
  bg: "#F8F9F7",
  card: "#FFFFFF",
  text: "#202E29",
  textSecondary: "#78847E",
  accent: "#2D6553",
  accentSoft: "#EAF1EB",
  accentYellow: "#FFD166",
  border: "#E3E8E2",
  danger: "#D64545",
  safe: "#5A9E6F",
  stage: "#F0F3EE",
};

const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
const radius = { sm: 12, md: 20, lg: 24 };

const MIN_SPREADS = 2;
const MAX_SPREADS = 20;
const PREVIEW_HEIGHT = 370;
const MIN_PREVIEW_ZOOM = 0.65;
const MAX_PREVIEW_ZOOM = 2.5;
const MINI_PER = 0.45;
const MINI_BASE = 2.5;
const POSTCARD_PRICE = 3.9;
const SPREAD_PRICE = 1.2;

// ═══════════════════════════ Типы ═══════════════════════════
type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Screen =
  "home" | "photoPicker" | "builder" | "checkout" | "orders" | "profile";
type ProductCategory = "print" | "photobook" | "mini" | "poster" | "postcard";
type PaperType = "matte" | "glossy";
type PosterOrientation = "portrait" | "landscape";

type Photo = { id: string; uri: string; width?: number; height?: number };
type PhotoSlot = { id: string; photoId?: string };

type PrintFinish = {
  margin: number;
  marginColor: string;
  frame: number;
  frameColor: string;
};

const DEFAULT_PRINT_FINISH: PrintFinish = {
  margin: 2,
  marginColor: "#FFFFFF",
  frame: 0,
  frameColor: "#25382E",
};
const PRINT_COLORS = [
  { name: "Белый", value: "#FFFFFF" },
  { name: "Кремовый", value: "#F5E6D3" },
  { name: "Серый", value: "#9DA7A0" },
  { name: "Чёрный", value: "#25382E" },
  { name: "Зелёный", value: "#6C9278" },
  { name: "Синий", value: "#557FAD" },
  { name: "Красный", value: "#BD5D54" },
  { name: "Розовый", value: "#E8B5C4" },
  { name: "Жёлтый", value: "#E5C36A" },
  { name: "Лиловый", value: "#A99AC4" },
];

type ProductConfig = {
  category: ProductCategory;
  printFormatId: string;
  paper: PaperType;
  copies: number;
  bookLineId: string;
  bookFormat: string;
  spreads: number;
  coverColorId: string;
  bookTemplateId: string;
  bookTitle: string;
  posterOrientation: PosterOrientation;
  posterSizeId: string;
  postcardTemplateId: string;
  postcardCaption: string;
  slots: PhotoSlot[];
  printFinish?: PrintFinish;
  posterFinish?: PrintFinish;
};

// Старые проекты без настроек полей получают значения по умолчанию.
function getPrintFinish(
  cfg: ProductConfig,
  category: "print" | "poster",
): PrintFinish {
  return {
    ...DEFAULT_PRINT_FINISH,
    margin: category === "poster" ? 10 : DEFAULT_PRINT_FINISH.margin,
    ...(category === "print" ? cfg.printFinish : cfg.posterFinish),
  };
}

// ═══════════════════════════ Помощники ═══════════════════════════
const money = (n: number) => `${n.toFixed(2).replace(".", ",")} BYN`;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const PRODUCT_TABS: {
  id: ProductCategory;
  label: string;
  short: string;
  icon: IconName;
  blurb: string;
  from: string;
}[] = [
  {
    id: "print",
    label: "Фотопечать",
    short: "Печать",
    icon: "print-outline",
    blurb: "Классические отпечатки",
    from: `от ${money(PRINT_FORMATS[0].pricePer)}`,
  },
  {
    id: "photobook",
    label: "Фотокнига",
    short: "Книга",
    icon: "book-outline",
    blurb: "История в разворотах",
    from: `от ${money(BOOK_LINES[0].basePrice)}`,
  },
  {
    id: "mini",
    label: "Мини-снимки",
    short: "Мини",
    icon: "grid-outline",
    blurb: "Квадратные карточки",
    from: `от ${money(MINI_BASE + MINI_PER * 4)}`,
  },
  {
    id: "poster",
    label: "Постер",
    short: "Постер",
    icon: "image-outline",
    blurb: "Одно фото на стену",
    from: `от ${money(POSTER_SIZES[0].price)}`,
  },
  {
    id: "postcard",
    label: "Открытка",
    short: "Открытка",
    icon: "mail-outline",
    blurb: "Фото и тёплые слова",
    from: `от ${money(POSTCARD_PRICE)}`,
  },
];

const HINT_TO_CATEGORY: Record<string, ProductCategory> = {
  print: "print",
  photobook: "photobook",
  gift: "postcard",
};

let photoIdSeq = 0;
function makePhotoId() {
  photoIdSeq += 1;
  return `ph-${photoIdSeq}`;
}

function defaultSpreads(photoCount: number) {
  return clamp(Math.ceil((photoCount - 1) / 2), MIN_SPREADS, MAX_SPREADS);
}

function slotCountFor(
  cat: ProductCategory,
  spreads: number,
  photoCount: number,
): number {
  switch (cat) {
    case "print":
      return Math.max(1, photoCount);
    case "mini":
      return Math.max(4, photoCount);
    case "poster":
      return 1;
    case "postcard":
      return 2;
    case "photobook":
      return 1 + spreads * 2;
    default:
      return 1;
  }
}

/** Приводит ячейки в соответствие с фото: убирает пропавшие, дубли, добавляет недостающие и (по умолчанию) заполняет пустые. */
function syncSlots(
  cfg: ProductConfig,
  photos: Photo[],
  autofill = true,
): PhotoSlot[] {
  const count = slotCountFor(cfg.category, cfg.spreads, photos.length);
  const ids = new Set(photos.map((p) => p.id));
  const used = new Set<string>();
  const slots: PhotoSlot[] = Array.from({ length: count }, (_, i) => {
    let photoId = cfg.slots[i]?.photoId;
    if (photoId && (!ids.has(photoId) || used.has(photoId)))
      photoId = undefined;
    if (photoId) used.add(photoId);
    return { id: `${cfg.category}-slot-${i}`, photoId };
  });
  if (autofill) {
    const free = photos.filter((p) => !used.has(p.id));
    let k = 0;
    for (const s of slots) {
      if (!s.photoId && k < free.length) {
        s.photoId = free[k].id;
        k += 1;
      }
    }
  }
  return slots;
}

function makeConfig(
  category: ProductCategory,
  photos: Photo[],
  prev?: ProductConfig,
): ProductConfig {
  const base: ProductConfig = prev ?? {
    category,
    printFormatId: "10x15",
    paper: "matte",
    copies: 1,
    bookLineId: "lite",
    bookFormat: "25×25",
    spreads: defaultSpreads(photos.length),
    coverColorId: "cream",
    bookTemplateId: BOOK_TEMPLATES[0].id,
    bookTitle: "Наши лучшие моменты",
    posterOrientation: "portrait",
    posterSizeId: POSTER_SIZES[1].id,
    postcardTemplateId: POSTCARD_TEMPLATES[0].id,
    postcardCaption: "С любовью и теплом",
    slots: [],
  };
  const cfg: ProductConfig = {
    ...base,
    category,
    copies: prev && prev.category === category ? prev.copies : 1,
    slots: [],
  };
  return { ...cfg, slots: syncSlots(cfg, photos) };
}

function photoById(photos: Photo[], id?: string) {
  return photos.find((p) => p.id === id);
}

function parseRatio(fmt: string): number {
  const [w, h] = fmt.split("×").map(Number);
  return w && h ? w / h : 1;
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function pageForSlotIndex(i: number) {
  return i <= 0 ? 0 : Math.ceil(i / 2);
}

function filledCount(cfg: ProductConfig) {
  return cfg.slots.filter((s) => s.photoId).length;
}

function productTitle(cfg: ProductConfig): string {
  switch (cfg.category) {
    case "print":
      return `Фотопечать ${PRINT_FORMATS.find((x) => x.id === cfg.printFormatId)?.label ?? ""}`;
    case "photobook":
      return `Фотокнига ${BOOK_LINES.find((x) => x.id === cfg.bookLineId)?.name ?? ""} ${cfg.bookFormat}`;
    case "mini":
      return "Мини-снимки";
    case "poster":
      return `Постер ${POSTER_SIZES.find((x) => x.id === cfg.posterSizeId)?.label ?? ""}`;
    case "postcard":
      return "Открытка";
    default:
      return "Продукт PicPac";
  }
}

function productDetails(cfg: ProductConfig): string {
  const filled = filledCount(cfg);
  switch (cfg.category) {
    case "print":
      return `${filled * cfg.copies} отпечатков · ${cfg.paper === "matte" ? "матовая" : "глянцевая"} бумага`;
    case "photobook":
      return `${cfg.spreads} разворотов · ${COVER_COLORS.find((c) => c.id === cfg.coverColorId)?.label.toLowerCase()} обложка`;
    case "mini":
      return `${filled} мини-снимков`;
    case "poster":
      return cfg.posterOrientation === "portrait"
        ? "Вертикальный"
        : "Горизонтальный";
    case "postcard":
      return `${cfg.copies} шт · ${POSTCARD_TEMPLATES.find((t) => t.id === cfg.postcardTemplateId)?.name}`;
    default:
      return "";
  }
}

function estimatePrice(cfg: ProductConfig): number {
  const filled = filledCount(cfg);
  switch (cfg.category) {
    case "print": {
      const f = PRINT_FORMATS.find((x) => x.id === cfg.printFormatId);
      return (f?.pricePer ?? 0.65) * filled * cfg.copies;
    }
    case "photobook": {
      const line = BOOK_LINES.find((x) => x.id === cfg.bookLineId);
      return (line?.basePrice ?? 49.9) + cfg.spreads * SPREAD_PRICE;
    }
    case "mini":
      return filled * MINI_PER + MINI_BASE;
    case "poster":
      return POSTER_SIZES.find((x) => x.id === cfg.posterSizeId)?.price ?? 24.9;
    case "postcard":
      return POSTCARD_PRICE * cfg.copies;
    default:
      return 0;
  }
}

// Анимации меняют прозрачность и положение контейнера, сохраняя геометрию 3D внутри.
function MotionView({
  children,
  style,
  kind = "section",
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof Animated.View>["style"];
  kind?: "screen" | "panel" | "product" | "section";
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: kind === "screen" ? 260 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [progress, kind]);
  const lift = kind === "screen" ? 10 : kind === "section" ? 6 : 0;
  const scale = kind === "panel" ? 0.97 : kind === "product" ? 0.985 : 1;
  return (
    <Animated.View
      testID={`motion-${kind}`}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [lift, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [scale, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = "primary",
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  icon?: IconName;
}) {
  const isPrimary = variant === "primary";
  const textColor = disabled
    ? colors.textSecondary
    : isPrimary
      ? "#fff"
      : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        isPrimary ? styles.btnFill : styles.btnOutline,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SettingGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingGroupTitle}>{title}</Text>
      {hint ? <Text style={styles.settingGroupHint}>{hint}</Text> : null}
      <View style={styles.settingGroupChips}>{children}</View>
    </View>
  );
}

function RgbSlider({ label, value, onChange }: { label: "R" | "G" | "B"; value: number; onChange: (value: number) => void }) {
  const trackWidth = useRef(1);
  const update = (x: number) => onChange(Math.round(clamp(x / trackWidth.current, 0, 1) * 255));
  const endColors = label === "R" ? ["#000", "#F44"] : label === "G" ? ["#000", "#4B5"] : ["#000", "#47F"];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ width: 14, color: colors.text, fontWeight: "600" }}>{label}</Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Цвет фона, канал ${label}`}
        accessibilityValue={{ min: 0, max: 255, now: value }}
        style={{ flex: 1, height: 32, justifyContent: "center", touchAction: "none" } as object}
        onLayout={(event) => { trackWidth.current = event.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => update(event.nativeEvent.locationX)}
        onResponderMove={(event) => update(event.nativeEvent.locationX)}
      >
        <LinearGradient pointerEvents="none" colors={endColors as [string, string]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 8, borderRadius: 4 }} />
        <View pointerEvents="none" style={{ position: "absolute", left: `${value / 255 * 100}%`, width: 18, height: 18,
          borderRadius: 9, backgroundColor: "#fff", borderWidth: 2, borderColor: colors.accent,
          transform: [{ translateX: -9 }] }} />
      </View>
      <Text style={{ width: 30, textAlign: "right", color: colors.text }}>{value}</Text>
    </View>
  );
}

function HoldButton({sign, change}: {sign: number; change?: (delta: number) => void}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);
  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  return <Pressable style={styles.stepperBtn} accessibilityRole="button"
    accessibilityLabel={sign > 0 ? "Увеличить яркость" : "Уменьшить яркость"}
    onPressIn={() => {
      stop();
      repeated.current = false;
      const start = Date.now();
      const repeat = () => {
        repeated.current = true;
        change?.(sign);
        timer.current = setTimeout(repeat, Math.max(28, 180 - (Date.now() - start) / 10));
      };
      timer.current = setTimeout(repeat, 400);
    }}
    onPressOut={stop} onPress={() => { if (!repeated.current) change?.(sign); }}>
    <Ionicons name={sign > 0 ? "add" : "remove"} size={20} color={colors.text} />
  </Pressable>;
}

function Stepper({
  label,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Уменьшить значение"
        onPress={onMinus}
        disabled={minusDisabled}
        style={[styles.stepperBtn, minusDisabled && styles.stepperBtnOff]}
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Увеличить значение"
        onPress={onPlus}
        disabled={plusDisabled}
        style={[styles.stepperBtn, plusDisabled && styles.stepperBtnOff]}
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

function Notice({
  tone,
  icon,
  text,
  actionLabel,
  onAction,
}: {
  tone: "info" | "warn";
  icon: IconName;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const warn = tone === "warn";
  return (
    <View style={[styles.notice, warn ? styles.noticeWarn : styles.noticeInfo]}>
      <Ionicons
        name={icon}
        size={18}
        color={warn ? colors.danger : colors.accent}
      />
      <Text style={[styles.noticeText, warn && { color: colors.danger }]}>
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.noticeAction}>
          <Text style={styles.noticeActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.screenHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
        {right}
      </View>
    </View>
  );
}

function BottomNav({
  active,
  onHome,
  onOrders,
  onProfile,
}: {
  active: "home" | "orders" | "profile";
  onHome: () => void;
  onOrders: () => void;
  onProfile: () => void;
}) {
  const items: {
    id: "home" | "orders" | "profile";
    label: string;
    icon: IconName;
    onPress: () => void;
  }[] = [
    { id: "home", label: "Главная", icon: "home-outline", onPress: onHome },
    {
      id: "orders",
      label: "Заказы",
      icon: "receipt-outline",
      onPress: onOrders,
    },
    {
      id: "profile",
      label: "Профиль",
      icon: "person-outline",
      onPress: onProfile,
    },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={item.onPress}
          style={styles.bottomNavItem}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={active === item.id ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.bottomNavLabel,
              active === item.id && { color: colors.accent },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ═══════════════════════════ Ячейки и макеты ═══════════════════════════
function EmptySlot({ hint, compact }: { hint?: string; compact?: boolean }) {
  return (
    <View style={styles.emptySlot}>
      <Ionicons
        name="add-circle-outline"
        size={compact ? 18 : 24}
        color={colors.accent}
      />
      {!compact && hint ? (
        <Text style={styles.emptySlotText}>{hint}</Text>
      ) : null}
    </View>
  );
}

function SlotCell({
  photo,
  selected,
  swap,
  onPress,
  style,
  crop,
  compact,
  hint = "Добавить",
}: {
  photo?: Photo;
  selected?: boolean;
  swap?: boolean;
  onPress?: () => void;
  style?: object;
  crop?: boolean;
  compact?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={photo ? "Заменить фото" : "Добавить фото"}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.slot,
        style,
        selected && styles.slotSelected,
        swap && styles.slotSwap,
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo.uri }}
          style={styles.fill}
          resizeMode="cover"
        />
      ) : (
        <EmptySlot hint={hint} compact={compact} />
      )}
      {crop ? (
        <View style={styles.cropBadge}>
          <Ionicons name="crop-outline" size={10} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

type MockupProps = {
  cfg: ProductConfig;
  photos: Photo[];
  selectedSlotId?: string | null;
  swapSlotId?: string | null;
  onSlotPress?: (slotId: string) => void;
};

// Каждая сторона изделия — плоскость в общей системе координат.
// Перспектива включена в матрицу: React Native допускает только один matrix.
function productPlane(
  pitch: number,
  yaw: number,
  position: [number, number, number],
  localYaw = 0,
  localPitch = 0,
) {
  const radians = Math.PI / 180;
  const x = pitch * radians,
    y = yaw * radians;
  const a = localYaw * radians,
    b = localPitch * radians;
  const right = [
    Math.cos(y),
    Math.sin(x) * Math.sin(y),
    -Math.cos(x) * Math.sin(y),
  ];
  const down = [0, Math.cos(x), Math.sin(x)];
  const normal = [
    Math.sin(y),
    -Math.sin(x) * Math.cos(y),
    Math.cos(x) * Math.cos(y),
  ];
  const rotate = (v: number[]) =>
    right.map((_, i) => right[i] * v[0] + down[i] * v[1] + normal[i] * v[2]);
  const u = rotate([Math.cos(a), 0, -Math.sin(a)]);
  const v = rotate([
    Math.sin(a) * Math.sin(b),
    Math.cos(b),
    Math.cos(a) * Math.sin(b),
  ]);
  const n = rotate([
    Math.sin(a) * Math.cos(b),
    -Math.sin(b),
    Math.cos(a) * Math.cos(b),
  ]);
  const center = rotate(position);
  const distance = 950;
  const matrix = [
    ...u,
    -u[2] / distance,
    ...v,
    -v[2] / distance,
    ...n,
    -n[2] / distance,
    ...center,
    1 - center[2] / distance,
  ];
  return {
    matrix,
    normal: n,
    visible:
      n[2] * distance -
        n.reduce((sum, value, i) => sum + value * center[i], 0) >
      0.0001,
    depth: Math.round(center[2] * 100),
  };
}

// Все шесть граней меняют размеры по одному времени анимации.
// Общая LayoutAnimation меняла их независимо и могла растянуть торец поверх фото.
function useProductSize(width: number, height: number) {
  const [size, setSize] = useState({ width, height });
  const current = useRef(size);
  useEffect(() => {
    const from = current.current;
    if (
      Math.abs(width - from.width) < 0.01 &&
      Math.abs(height - from.height) < 0.01
    )
      return;
    let started: number | null = null;
    let frameId: number;
    const frame = (time: number) => {
      if (started === null) started = time;
      const progress = Math.min(1, (time - started) / 240);
      const ease = 1 - Math.pow(1 - progress, 3);
      current.current = {
        width: from.width + (width - from.width) * ease,
        height: from.height + (height - from.height) * ease,
      };
      setSize(current.current);
      if (progress < 1) frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [width, height]);
  return size;
}

// Правки фотографий выполняются прямо на объёмном изделии.
function ProductPreview({
  cfg,
  photos,
  scene,
  onSceneChange,
  onMaterial,
  onBrightness,
  showSceneControls = true,
  selectedSlotId,
  swapSlotId,
  onSlotPress,
  bookPage = 0,
  onBookPage,
  onInteractionChange,
  onTextPress,
}: MockupProps & {
  scene: SceneSettings;
  onSceneChange: (patch: Partial<SceneSettings>) => void;
  onMaterial?: (paper: PaperType) => void;
  onBrightness?: (delta: number) => void;
  showSceneControls?: boolean;
  bookPage?: number;
  onBookPage?: (n: number) => void;
  onInteractionChange?: (active: boolean) => void;
  onTextPress?: (field: "postcardCaption" | "bookTitle") => void;
}) {
  const { width } = useWindowDimensions();
  // Состояние товара остаётся в PicPacApp. Здесь хранятся только ракурс и
  // номер просматриваемого снимка. Поворот не меняет печатный макет.
  const [angle, setAngle] = useState({ x: -18, y: -28, zoom: 1 });
  const [photoIndex, setPhotoIndex] = useState(0);
  const [backgroundDraft, setBackgroundDraft] = useState(scene.backgroundColor);
  const viewRef = useRef(angle);
  // Обратная проекция касания на видимую сторону сохраняет прямое редактирование.
  // Сам жест принимает постоянный слой, который не исчезает при повороте ребром.
  const tapHandler = useRef<(x: number, y: number) => void>(() => {});
  const viewerSize = useRef({ width: 0, height: PREVIEW_HEIGHT });

  const paintFrame = useRef<number | null>(null);
  const motionFrame = useRef<number | null>(null);
  const suppressTap = useRef(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef({
    x: 0,
    y: 0,
    count: 0,
    span: 0,
    zoom: 1,
    pinched: false,
  });

  // События пальца могут приходить чаще кадров экрана. Рисуем один раз за кадр.
  const applyView = useCallback((next: typeof angle) => {
    viewRef.current = next;
    if (paintFrame.current !== null) return;
    paintFrame.current = requestAnimationFrame(() => {
      paintFrame.current = null;
      setAngle(viewRef.current);
    });
  }, []);

  const stopMotion = useCallback(() => {
    if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    motionFrame.current = null;
  }, []);

  const moveView = useCallback(
    (target: typeof angle) => {
      stopMotion();
      const from = { ...viewRef.current };
      // Короткий путь к лицевой стороне, даже после нескольких полных оборотов.
      const turn = ((((target.y - from.y + 180) % 360) + 360) % 360) - 180;
      const tilt = ((((target.x - from.x + 180) % 360) + 360) % 360) - 180;
      let started: number | null = null;
      const frame = (time: number) => {
        if (started === null) started = time;
        const progress = Math.min(1, (time - started) / 220);
        const ease = 1 - Math.pow(1 - progress, 3);
        applyView({
          x: from.x + tilt * ease,
          y: from.y + turn * ease,
          zoom: from.zoom + (target.zoom - from.zoom) * ease,
        });
        motionFrame.current =
          progress < 1 ? requestAnimationFrame(frame) : null;
      };
      motionFrame.current = requestAnimationFrame(frame);
    },
    [applyView, stopMotion],
  );

  const setView = (y: number) => moveView({ ...viewRef.current, x: -18, y });
  const gesture = useMemo(() => {
    const span = (touches: readonly { pageX: number; pageY: number }[]) =>
      touches.length < 2
        ? 0
        : Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY,
          );
    const finish = () => {
      onInteractionChange?.(false);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => {
        suppressTap.current = false;
      }, 180);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.numberActiveTouches > 1 || Math.hypot(g.dx, g.dy) > 3,
      onPanResponderGrant: (event) => {
        stopMotion();
        if (tapTimer.current) clearTimeout(tapTimer.current);
        onInteractionChange?.(true);
        suppressTap.current = true;
        const touches = event.nativeEvent.touches;
        touch.current = {
          x: touches[0]?.pageX ?? 0,
          y: touches[0]?.pageY ?? 0,
          count: touches.length,
          span: span(touches),
          zoom: viewRef.current.zoom,
          pinched: touches.length > 1,
        };
      },
      onPanResponderMove: (event) => {
        const touches = event.nativeEvent.touches;
        const first = touches[0];
        if (!first) return;
        const previous = touch.current;
        // При добавлении или отпускании второго пальца начинаем отсчёт заново.
        if (touches.length !== previous.count) {
          touch.current = {
            x: first.pageX,
            y: first.pageY,
            count: touches.length,
            span: span(touches),
            zoom: viewRef.current.zoom,
            pinched: true,
          };
          return;
        }
        if (touches.length > 1) {
          if (previous.span > 0)
            applyView({
              ...viewRef.current,
              zoom: clamp(
                (previous.zoom * span(touches)) / previous.span,
                MIN_PREVIEW_ZOOM,
                MAX_PREVIEW_ZOOM,
              ),
            });
          previous.pinched = true;
        } else {
          applyView({
            ...viewRef.current,
            x: viewRef.current.x - (first.pageY - previous.y) * 0.32,
            y: viewRef.current.y + (first.pageX - previous.x) * 0.42,
          });
        }
        previous.x = first.pageX;
        previous.y = first.pageY;
      },
      onPanResponderRelease: (event, g) => {
        finish();
        if (touch.current.pinched) return;
        if (Math.hypot(g.dx, g.dy) < 5) {
          tapHandler.current(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
          return;
        }
        let vx = clamp(g.vx, -2, 2) * 0.42;
        let vy = clamp(-g.vy, -2, 2) * 0.32;
        let previousTime: number | null = null;
        const coast = (time: number) => {
          const elapsed =
            previousTime === null ? 16 : Math.min(time - previousTime, 32);
          previousTime = time;
          const friction = Math.exp(-elapsed / 125);
          vx *= friction;
          vy *= friction;
          applyView({
            ...viewRef.current,
            x: viewRef.current.x + vy * elapsed,
            y: viewRef.current.y + vx * elapsed,
          });
          motionFrame.current =
            Math.abs(vx) + Math.abs(vy) > 0.004
              ? requestAnimationFrame(coast)
              : null;
        };
        motionFrame.current = requestAnimationFrame(coast);
      },
      onPanResponderTerminate: () => {
        stopMotion();
        finish();
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }, [onInteractionChange, applyView, stopMotion]);

  useEffect(
    () => () => {
      stopMotion();
      if (paintFrame.current !== null) cancelAnimationFrame(paintFrame.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      onInteractionChange?.(false);
    },
    [onInteractionChange, stopMotion],
  );

  const book = cfg.category === "photobook";
  const postcard = cfg.category === "postcard";
  const page = clamp(bookPage, 0, cfg.spreads);
  const spread = book && page > 0;
  const index = clamp(photoIndex, 0, Math.max(0, cfg.slots.length - 1));
  const currentSlot = cfg.slots[index];
  const template = POSTCARD_TEMPLATES.find(
    (t) => t.id === cfg.postcardTemplateId,
  );
  const cover =
    COVER_COLORS.find((c) => c.id === cfg.coverColorId)?.color ?? "#F5E6D3";
  const bookTemplate = BOOK_TEMPLATES.find((t) => t.id === cfg.bookTemplateId);
  const format = PRINT_FORMATS.find((f) => f.id === cfg.printFormatId);
  const posterSize = POSTER_SIZES.find((s) => s.id === cfg.posterSizeId);
  let ratio = format?.ratio ?? 2 / 3;
  if (postcard) ratio = 1 / 1.4;
  if (book) ratio = parseRatio(cfg.bookFormat) * (spread ? 2 : 1);
  if (cfg.category === "mini") ratio = 1;
  if (cfg.category === "poster") {
    const [w, h] = (posterSize?.label ?? "30×40")
      .split("×")
      .map(Number.parseFloat);
    ratio = cfg.posterOrientation === "portrait" ? w / h : h / w;
  }
  const availableWidth = Math.min(width - 112, 330);
  const longSide = Math.max(...(format?.id ?? "10x15").split("x").map(Number));
  const targetHeight =
    cfg.category === "print"
      ? clamp(220 * Math.sqrt(longSide / 15), 220, 275)
      : 250;
  const targetWidth = Math.min(availableWidth, targetHeight * ratio);
  const size = useProductSize(targetWidth, targetWidth / ratio);
  const objectWidth = size.width * angle.zoom;
  const objectHeight = size.height * angle.zoom;
  const yaw = angle.y;
  const pitch = angle.x;
  const rear =
    Math.cos((yaw * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) < 0;
  const thickness = book ? (spread ? 4 : 16) : 1.5;
  const lx = (scene.lightPosition.x - 0.5) * 2;
  const ly = (scene.lightPosition.y - 0.5) * 2;
  const distance = Math.hypot(lx, ly, 0.78);
  const lightDirection = [lx / distance, ly / distance, 0.78 / distance];
  const lightDragStart = useRef(scene.lightPosition);
  const lightDragPage = useRef({ x: 0, y: 0 });
  const darkRoom = isDark(scene.backgroundColor);
  const rgb = [1, 3, 5].map((offset) => parseInt(scene.backgroundColor.slice(offset, offset + 2), 16));
  const setRgb = (channel: number, value: number) => {
    const next = [...rgb];
    next[channel] = value;
    setBackground(`#${next.map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase()}`);
  };
  const filterTint =
    SCENE_FILTERS.find((item) => item.id === scene.filter)?.tint ??
    "transparent";
  const setBackground = (color: string) => {
    setBackgroundDraft(color);
    onSceneChange({ backgroundColor: color });
  };

  useEffect(() => {
    if (!postcard || !selectedSlotId) return;
    const backSelected = cfg.slots[1]?.id === selectedSlotId;
    moveView({ ...viewRef.current, x: -18, y: backSelected ? 152 : -28 });
  }, [selectedSlotId, postcard, cfg.slots, moveView]);

  useEffect(() => {
    if (book || postcard || !selectedSlotId) return;
    const selectedIndex = cfg.slots.findIndex((s) => s.id === selectedSlotId);
    if (selectedIndex >= 0) setPhotoIndex(selectedIndex);
  }, [selectedSlotId, cfg.slots, book, postcard]);

  // Объёмное изделие читает slots и ProductConfig из основного редактора.
  // Поэтому замена фото, подпись открытки и параметры обложки видны сразу.
  function slot(slot: PhotoSlot | undefined, hint: string) {
    if (!slot) return null;
    return (
      <SlotCell
        photo={photoById(photos, slot.photoId)}
        selected={slot.id === selectedSlotId}
        swap={slot.id === swapSlotId}
        onPress={
          onSlotPress
            ? () => {
                if (!suppressTap.current) onSlotPress(slot.id);
              }
            : undefined
        }
        style={styles.surfacePhoto}
        hint={hint}
      />
    );
  }

  function surface(back: boolean) {
    if (back) {
      if (postcard)
        return (
          <View
            style={[
              styles.cardReverse,
              { backgroundColor: template?.tint ?? "#fff" },
            ]}
          >
            <View style={styles.reverseTop}>
              <View style={{ width: 68, height: 80 }}>
                {slot(cfg.slots[1], "Фото")}
              </View>
              <View style={styles.postcardStamp} />
            </View>
            <Pressable
              disabled={!onTextPress}
              accessibilityRole="button"
              accessibilityLabel="Изменить текст открытки"
              style={{ flex: 1 }}
              onPress={() => {
                if (!suppressTap.current) onTextPress?.("postcardCaption");
              }}
            >
              <Text style={styles.reverseCaption}>
                {cfg.postcardCaption || "Нажмите, чтобы написать"}
              </Text>
            </Pressable>
            <View style={styles.postcardLine} />
            <View style={styles.postcardLine} />
          </View>
        );
      return (
        <View
          style={[
            styles.surfaceBack,
            { backgroundColor: book ? cover : "#fffdfa" },
          ]}
        >
          <Text
            style={{
              color: book && isDark(cover) ? "#fff" : colors.textSecondary,
              fontSize: 12,
            }}
          >
            {book ? cfg.bookTitle : "Оборот"}
          </Text>
        </View>
      );
    }
    if (spread)
      return (
        <View style={styles.surfaceSpread}>
          {cfg.slots.slice(page * 2 - 1, page * 2 + 1).map((s) => (
            <View key={s.id} style={styles.surfacePage}>
              {slot(s, "Фото")}
            </View>
          ))}
          <View pointerEvents="none" style={styles.surfaceFold} />
        </View>
      );
    if (book)
      return (
        <View style={[styles.surfaceCover, { backgroundColor: cover }]}>
          <View style={styles.surfaceCoverPhoto}>
            {slot(cfg.slots[0], "Обложка")}
          </View>
          <Pressable
            disabled={!onTextPress}
            accessibilityLabel="Изменить название альбома"
            onPress={() => {
              if (!suppressTap.current) onTextPress?.("bookTitle");
            }}
          >
            <Text
              style={[
                styles.surfaceTitle,
                { color: isDark(cover) ? "#fff" : colors.text },
              ]}
              numberOfLines={2}
            >
              {cfg.bookTitle}
            </Text>
          </Pressable>
          {bookTemplate?.titleStyle === "band" ? (
            <View style={styles.coverRule} />
          ) : null}
        </View>
      );
    if (cfg.category === "print" || cfg.category === "poster") {
      const finish = getPrintFinish(cfg, cfg.category);
      const dimensions =
        cfg.category === "print"
          ? (format?.id ?? "10x15").split("x").map(Number)
          : (posterSize?.label ?? "30×40").split("×").map(Number.parseFloat);
      const paperWidthMM =
        (cfg.category === "poster" && cfg.posterOrientation === "landscape"
          ? dimensions[1]
          : dimensions[0]) * 10;
      const pixelsPerMM = objectWidth / paperWidthMM;
      return (
        <View
          testID="print-paper"
          style={[
            styles.surfacePrint,
            {
              padding: finish.margin * pixelsPerMM,
              backgroundColor: finish.marginColor,
            },
          ]}
        >
          <View
            testID="print-frame"
            style={{
              flex: 1,
              borderWidth: finish.frame * pixelsPerMM,
              borderColor: finish.frameColor,
              backgroundColor: finish.frameColor,
            }}
          >
            {slot(currentSlot, "Фото")}
          </View>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.surfacePrint,
          {
            padding: cfg.category === "mini" ? 10 : 4,
            paddingBottom: cfg.category === "mini" ? 30 : 4,
          },
        ]}
      >
        {slot(
          postcard ? cfg.slots[0] : currentSlot,
          postcard ? "Лицевая сторона" : "Фото",
        )}
      </View>
    );
  }

  // Корпус изделия состоит из лицевой, задней и четырёх боковых сторон.
  const planes: {
    id: string;
    width: number;
    height: number;
    position: [number, number, number];
    yaw: number;
    pitch: number;
  }[] = [
    {
      id: "front",
      width: objectWidth,
      height: objectHeight,
      position: [0, 0, thickness / 2],
      yaw: 0,
      pitch: 0,
    },
    {
      id: "back",
      width: objectWidth,
      height: objectHeight,
      position: [0, 0, -thickness / 2],
      yaw: 180,
      pitch: 0,
    },
    {
      id: "left",
      width: thickness,
      height: objectHeight,
      position: [-objectWidth / 2, 0, 0],
      yaw: -90,
      pitch: 0,
    },
    {
      id: "right",
      width: thickness,
      height: objectHeight,
      position: [objectWidth / 2, 0, 0],
      yaw: 90,
      pitch: 0,
    },
    {
      id: "top",
      width: objectWidth,
      height: thickness,
      position: [0, -objectHeight / 2, 0],
      yaw: 0,
      pitch: 90,
    },
    {
      id: "bottom",
      width: objectWidth,
      height: thickness,
      position: [0, objectHeight / 2, 0],
      yaw: 0,
      pitch: -90,
    },
  ];

  useEffect(() => {
    tapHandler.current = (screenX, screenY) => {
      const side = planes.find((plane) => {
        if (plane.id !== "front" && plane.id !== "back") return false;
        return productPlane(pitch, yaw, plane.position, plane.yaw, plane.pitch)
          .visible;
      });
      if (!side) return;
      const { matrix: m } = productPlane(
        pitch,
        yaw,
        side.position,
        side.yaw,
        side.pitch,
      );
      const sx = screenX - viewerSize.current.width / 2;
      const sy = screenY - viewerSize.current.height / 2;
      const a = m[0] - sx * m[3],
        b = m[4] - sx * m[7],
        c = sx * m[15] - m[12];
      const d = m[1] - sy * m[3],
        e = m[5] - sy * m[7],
        f = sy * m[15] - m[13];
      const determinant = a * e - b * d;
      if (Math.abs(determinant) < 0.00001) return;
      const x = (c * e - b * f) / determinant + objectWidth / 2;
      const y = (a * f - c * d) / determinant + objectHeight / 2;
      if (x < 0 || y < 0 || x > objectWidth || y > objectHeight) return;
      if (side.id === "back") {
        if (postcard) {
          if (x >= 14 && x <= 82 && y >= 14 && y <= 94)
            onSlotPress?.(cfg.slots[1]?.id);
          else if (y > 94) onTextPress?.("postcardCaption");
        } else if (book) onTextPress?.("bookTitle");
        return;
      }
      if (book) {
        if (spread)
          onSlotPress?.(
            cfg.slots[page * 2 - (x < objectWidth / 2 ? 1 : 0)]?.id,
          );
        else if (y > objectHeight - 48) onTextPress?.("bookTitle");
        else onSlotPress?.(cfg.slots[0]?.id);
      } else onSlotPress?.((postcard ? cfg.slots[0] : currentSlot)?.id);
    };
  });

  const multiple = !book && !postcard && cfg.slots.length > 1;
  const label = book
    ? spread
      ? `Разворот ${page} из ${cfg.spreads}`
      : "Обложка"
    : multiple
      ? `Фото ${index + 1} из ${cfg.slots.length}`
      : rear
        ? "Оборот"
        : "Лицевая сторона";
  const previous = () =>
    book
      ? onBookPage?.(Math.max(0, page - 1))
      : setPhotoIndex(Math.max(0, index - 1));
  const next = () =>
    book
      ? onBookPage?.(Math.min(cfg.spreads, page + 1))
      : setPhotoIndex(Math.min(cfg.slots.length - 1, index + 1));

  return (
    <View style={styles.objectPreview}>
      <View
        collapsable={false}
        style={[styles.viewerBounds, { backgroundColor: scene.backgroundColor }]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          borderLeftWidth: Math.min(width * 0.12, 100), borderRightWidth: Math.min(width * 0.12, 100),
          borderTopWidth: 27, borderBottomWidth: 29,
          borderLeftColor: darkRoom ? "rgba(255,255,255,0.035)" : "rgba(15,29,25,0.07)",
          borderRightColor: darkRoom ? "rgba(0,0,0,0.035)" : "rgba(15,29,25,0.05)",
          borderTopColor: darkRoom ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.10)",
          borderBottomColor: darkRoom ? "rgba(255,255,255,0.025)" : "rgba(15,29,25,0.035)",
        }]} />
        <LinearGradient pointerEvents="none" start={{x:scene.lightPosition.x,y:scene.lightPosition.y}}
          end={{x:1 - scene.lightPosition.x,y:1 - scene.lightPosition.y}}
          colors={[`rgba(255,252,238,${(darkRoom ? 0.055 : 0.14) * scene.lightBrightness / 100})`, "transparent", darkRoom ? "rgba(0,0,0,0.025)" : "rgba(14,30,24,0.08)"]}
          style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={{position:"absolute", bottom:30, alignSelf:"center", width:objectWidth * 0.83, height:12,
          borderRadius:"50%", backgroundColor:"rgba(22,33,28,0.09)", transform:[{translateX:-lx * 24}]}} />
        <View pointerEvents="none" style={styles.objectStage}>
          <View style={{ width: objectWidth, height: objectHeight }}>
            {planes.map((plane) => {
              const projected = productPlane(
                pitch,
                yaw,
                plane.position,
                plane.yaw,
                plane.pitch,
              );
              if (!projected.visible) return null;
              const transform =
                Platform.OS === "web"
                  ? `matrix3d(${projected.matrix.join(",")})`
                  : [{ matrix: projected.matrix }];
              const face = plane.id === "front" || plane.id === "back";
              const spine = book && plane.id === "left";
              const lightDot = projected.normal.reduce(
                (sum, component, i) => sum + component * lightDirection[i],
                0,
              );
              const directLight = (lightDot + Math.sqrt(lightDot * lightDot + 0.16)) / 2;
              const illumination =
                (0.4 + 0.6 * directLight) * scene.lightBrightness / 100;
              return (
                <View
                  key={`${cfg.category}-${spread ? "spread" : "single"}-${plane.id}`}
                  testID={`product-face-${plane.id}`}
                  collapsable={false}
                  renderToHardwareTextureAndroid={false}
                  pointerEvents={face ? "auto" : "none"}
                  style={[
                    styles.objectPlane,
                    {
                      width: plane.width,
                      height: plane.height,
                      left: (objectWidth - plane.width) / 2,
                      top: (objectHeight - plane.height) / 2,
                      transform,
                      zIndex: face ? 20 : 10,
                      backgroundColor: spine ? cover : "#E3DFD5",
                    },
                  ]}
                >
                  {face ? (
                    surface(plane.id === "back")
                  ) : spine ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.spineTitle,
                        { color: isDark(cover) ? "#fff" : colors.text },
                      ]}
                    >
                      {cfg.bookTitle}
                    </Text>
                  ) : book ? (
                    <View style={styles.pageEdges} />
                  ) : null}
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: illumination < 1 ? "#101820" : "#FFFFFF",
                        opacity:
                          illumination < 1
                            ? Math.min(0.68, (1 - illumination) * 0.72)
                            : Math.min(0.28, (illumination - 1) * 0.3),
                      },
                    ]}
                  />
                  {face && (() => {
                    const half = [lightDirection[0], lightDirection[1], lightDirection[2] + 1];
                    const alignment = Math.max(0, projected.normal.reduce((n, v, i) => n + v * half[i], 0) / Math.hypot(...half));
                    const glossy = cfg.paper === "glossy";
                    const shine = Math.min(0.85, Math.pow(alignment, glossy ? 9 : 2) * scene.lightBrightness / 100 * (glossy ? 0.85 : 0.09));
                    const center = clamp(0.5 + (lx - projected.normal[0]) * 0.25, 0.22, 0.78);
                    return <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill}
                      start={{x:0,y:0.2}} end={{x:1,y:0.8}}
                      colors={["transparent", `rgba(255,255,255,${shine})`, "transparent"]}
                      locations={[center - 0.2, center, center + 0.2]} />;
                  })()}
                  {scene.filter !== "none" && (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: filterTint },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
        <View
          collapsable={false}
          accessible={false}
          testID="product-gesture-surface"
          style={[
            styles.gestureSurface,
            Platform.OS === "web"
              ? ({ touchAction: "none", userSelect: "none" } as object)
              : null,
          ]}
          onLayout={(event) => {
            viewerSize.current = event.nativeEvent.layout;
          }}
          {...gesture.panHandlers}
        />
        <View
          testID="scene-light-source"
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            lightDragStart.current = scene.lightPosition;
            lightDragPage.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
          }}
          onResponderMove={(event) => onSceneChange({ lightPosition: {
            x: clamp(lightDragStart.current.x + (event.nativeEvent.pageX - lightDragPage.current.x) / viewerSize.current.width, 0, 1),
            y: clamp(lightDragStart.current.y + (event.nativeEvent.pageY - lightDragPage.current.y) / viewerSize.current.height, 0, 1),
          } })}
          style={[
            styles.sceneLightMarker,
            { left: `${3 + scene.lightPosition.x * 90}%`, top: `${3 + scene.lightPosition.y * 85}%` },
          ]}
        >
          <Ionicons
            name="sunny"
            size={18}
            color={isDark(scene.backgroundColor) ? "#FFE8A3" : "#B98735"}
          />
        </View>
      </View>
      {(book || multiple || postcard) && (
        <View style={styles.previewNavigation}>
          {book || multiple ? (
            <>
              <Pressable
                accessibilityLabel="Предыдущая страница или фото"
                disabled={(book ? page : index) === 0}
                onPress={previous}
                style={styles.previewArrow}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={
                    (book ? page : index) === 0 ? colors.border : colors.text
                  }
                />
              </Pressable>
              <Text style={styles.previewPageLabel}>{label}</Text>
              <Pressable
                accessibilityLabel="Следующая страница или фото"
                disabled={
                  book ? page === cfg.spreads : index === cfg.slots.length - 1
                }
                onPress={next}
                style={styles.previewArrow}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.text}
                />
              </Pressable>
            </>
          ) : postcard ? (
            <View style={styles.previewSides}>
              <Pressable
                onPress={() => {
                  setView(-28);
                }}
                style={styles.previewSide}
              >
                <Text
                  style={[
                    styles.previewPageLabel,
                    !rear && { color: colors.accent },
                  ]}
                >
                  Лицевая
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setView(152);
                }}
                style={styles.previewSide}
              >
                <Text
                  style={[
                    styles.previewPageLabel,
                    rear && { color: colors.accent },
                  ]}
                >
                  Оборот
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
      {showSceneControls && (
        <View style={styles.sceneControls}>
          <Text style={styles.sceneControlsTitle}>3D-пространство</Text>
          <Text style={styles.sceneControlLabel}>Перетащите солнце в сцене</Text>
          <Text style={styles.sceneControlLabel}>Яркость света</Text>
          <View style={styles.stepper}>
            <HoldButton sign={-1} change={onBrightness} />
            <Text style={styles.stepperLabel}>{scene.lightBrightness}%</Text>
            <HoldButton sign={1} change={onBrightness} />
          </View>
          <Text style={styles.sceneControlLabel}>Бумага</Text>
          <View style={styles.sceneChoices}>
            <Chip label="Матовая" active={cfg.paper === "matte"} onPress={() => onMaterial?.("matte")} />
            <Chip label="Глянцевая" active={cfg.paper === "glossy"} onPress={() => onMaterial?.("glossy")} />
          </View>
          <Text style={styles.sceneControlLabel}>Фильтр</Text>
          <View style={styles.sceneChoices}>
            {SCENE_FILTERS.map((filter) => (
              <Chip
                key={filter.id}
                label={filter.label}
                active={scene.filter === filter.id}
                onPress={() => onSceneChange({ filter: filter.id })}
              />
            ))}
          </View>
          <Text style={styles.sceneControlLabel}>Цвет фона</Text>
          <View style={styles.sceneChoices}>
            {SCENE_BACKGROUNDS.map((option) => (
              <Pressable
                key={option.color}
                accessibilityRole="button"
                accessibilityLabel={`Фон: ${option.name}`}
                accessibilityState={{
                  selected: scene.backgroundColor === option.color,
                }}
                onPress={() => setBackground(option.color)}
                style={[
                  styles.sceneSwatch,
                  { backgroundColor: option.color },
                  scene.backgroundColor === option.color &&
                    styles.sceneSwatchActive,
                ]}
              >
                {scene.backgroundColor === option.color && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={isDark(option.color) ? "#fff" : colors.text}
                  />
                )}
              </Pressable>
            ))}
            <TextInput
              accessibilityLabel="Свой цвет фона в формате HEX"
              style={styles.sceneColorInput}
              value={backgroundDraft}
              onChangeText={(value) => {
                setBackgroundDraft(value);
                if (/^#[0-9a-fA-F]{6}$/.test(value))
                  onSceneChange({ backgroundColor: value });
              }}
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>
          {(["R", "G", "B"] as const).map((label, channel) => (
            <RgbSlider key={label} label={label} value={rgb[channel]} onChange={(value) => setRgb(channel, value)} />
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════ Редактор ═══════════════════════════
function ActionTile({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionTile,
        active && styles.actionTileActive,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? colors.accent : colors.text}
      />
      <Text
        style={[styles.actionTileLabel, active && { color: colors.accent }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PhotoTray({
  photos,
  slots,
  selectedPhotoId,
  hasSelection,
  onPick,
  onAdd,
}: {
  photos: Photo[];
  slots: PhotoSlot[];
  selectedPhotoId?: string;
  hasSelection: boolean;
  onPick: (photoId: string) => void;
  onAdd: () => void;
}) {
  const used = new Set(slots.map((s) => s.photoId).filter(Boolean));
  return (
    <View style={styles.trayWrap}>
      <View style={styles.trayHeader}>
        <Text style={styles.trayTitle}>Ваши фото · {photos.length}</Text>
      </View>
      {hasSelection && (
        <Text style={styles.trayHint}>Выберите фото для замены</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trayRow}
      >
        <Pressable onPress={onAdd} style={styles.trayAdd}>
          <Ionicons name="add" size={22} color={colors.accent} />
          <Text style={styles.trayAddText}>Ещё</Text>
        </Pressable>
        {photos.map((p, index) => {
          const isUsed = used.has(p.id);
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Выбрать снимок ${index + 1}`}
              onPress={() => onPick(p.id)}
              style={[
                styles.trayThumb,
                p.id === selectedPhotoId && styles.trayThumbSelected,
              ]}
            >
              <Image
                source={{ uri: p.uri }}
                style={[styles.fill, !isUsed && { opacity: 0.9 }]}
              />
              {isUsed ? (
                <View style={styles.trayBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════ Заказы ═══════════════════════════
function orderStatusStyle(index: number) {
  switch (index) {
    case 0:
      return { bg: colors.accentSoft, text: colors.accent };
    case 1:
      return { bg: "#E8F4FC", text: "#2B6CB0" };
    case 2:
      return { bg: "#EEF8F1", text: colors.safe };
    case 3:
      return { bg: "#FFF8E6", text: "#B8860B" };
    case 4:
      return { bg: "#EEF8F1", text: colors.safe };
    default:
      return { bg: "#F3F0EC", text: colors.textSecondary };
  }
}

function StatusTimeline({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.timeline}>
      {ORDER_STATUSES.map((label, i) => {
        const done = i <= activeIndex;
        const current = i === activeIndex;
        return (
          <View key={label} style={styles.timelineStep}>
            <View style={styles.timelineDotRow}>
              <View
                style={[
                  styles.timelineBar,
                  i === 0 && { backgroundColor: "transparent" },
                  done && i > 0 && styles.timelineBarDone,
                ]}
              />
              <View
                style={[
                  styles.timelineDot,
                  done && styles.timelineDotDone,
                  current && styles.timelineDotCurrent,
                ]}
              />
              <View
                style={[
                  styles.timelineBar,
                  i === ORDER_STATUSES.length - 1 && {
                    backgroundColor: "transparent",
                  },
                  i < activeIndex && styles.timelineBarDone,
                ]}
              />
            </View>
            <Text
              style={[
                styles.timelineLabel,
                done && { color: colors.text },
                current && { color: colors.accent, fontWeight: "800" },
              ]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderCard({
  order,
  onPress,
  onRepeat,
}: {
  order: MockOrder;
  onPress?: () => void;
  onRepeat?: () => void;
}) {
  const pill = orderStatusStyle(order.statusIndex);
  return (
    <Pressable style={styles.orderCard} onPress={onPress} disabled={!onPress}>
      <Image source={{ uri: order.previewUri }} style={styles.orderCardImage} />
      <View style={styles.orderCardBody}>
        <Text style={styles.orderCardTitle} numberOfLines={2}>
          {order.title}
        </Text>
        <Text style={styles.orderCardMeta} numberOfLines={1}>
          {order.scenario} · {order.date}
        </Text>
        <Text style={styles.orderCardItems} numberOfLines={2}>
          {order.items}
        </Text>
        <View style={styles.orderCardFooter}>
          <Text style={styles.orderCardPrice}>{money(order.total)}</Text>
          <View style={[styles.orderStatusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.orderStatusText, { color: pill.text }]}>
              {ORDER_STATUSES[order.statusIndex]}
            </Text>
          </View>
        </View>
        {onRepeat ? (
          <Pressable onPress={onRepeat} style={{ marginTop: spacing.sm }}>
            <Text style={styles.orderRepeatText}>Повторить заказ</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          strong && styles.summaryStrong,
          accent && { color: colors.safe },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ═══════════════════════════ Приложение ═══════════════════════════
function PicPacApp() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [screen, setScreen] = useState<Screen>("home");
  const photosRef = useRef<Photo[]>([]);
  const [photos, setPhotosState] = useState<Photo[]>([]);
  const [scenarioTitle, setScenarioTitle] = useState<string | undefined>();
  const [cfg, setCfg] = useState<ProductConfig>(() => makeConfig("print", []));
  const [scene, setScene] = useState<SceneSettings>({
    backgroundColor: "#EFF2EC",
    lightPosition: { x: 0.23, y: 0.18 },
    lightBrightness: 100,
    filter: "none",
  });
  const updateScene = (patch: Partial<SceneSettings>) =>
    setScene((current) => ({ ...current, ...patch }));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [bookPage, setBookPage] = useState(0);
  const [checkoutPreviewOpen, setCheckoutPreviewOpen] = useState(false);
  const [editorPanel, setEditorPanelState] = useState<
    "products" | "settings" | "photos" | null
  >(null);
  const [panelContent, setPanelContent] = useState<
    "products" | "settings" | "photos"
  >("products");
  const setEditorPanel = useCallback(
    (panel: "products" | "settings" | "photos" | null) => {
      if (panel) setPanelContent(panel);
      setEditorPanelState(panel);
    },
    [],
  );
  const [textEditing, setTextEditing] = useState<
    "postcardCaption" | "bookTitle" | null
  >(null);
  const [textDraft, setTextDraft] = useState("");
  const [textField, setTextField] = useState<"postcardCaption" | "bookTitle">(
    "postcardCaption",
  );
  const pickingPhoto = useRef(false);
  const openTextEditor = (field: "postcardCaption" | "bookTitle") => {
    setTextDraft(cfg[field]);
    setTextField(field);
    setTextEditing(field);
  };

  const [previewInteracting, setPreviewInteracting] = useState(false);
  const handlePreviewInteraction = useCallback((active: boolean) => {
    // Отключаем нативную прокрутку сразу при касании, до распознавания движения.
    if (Platform.OS !== "web")
      scrollRef.current?.setNativeProps({ scrollEnabled: !active });
    setPreviewInteracting(active);
  }, []);

  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState("courier");
  const [paymentId, setPaymentId] = useState("card");
  const [promo, setPromo] = useState("");

  const setPhotos = (next: Photo[]) => {
    photosRef.current = next;
    setPhotosState(next);
  };

  const animate = () =>
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  // ——— Фото ———
  const pickAssets = async (multi: boolean): Promise<Photo[]> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Нужен доступ",
        "Разрешите доступ к галерее, чтобы выбрать фотографии.",
      );
      return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: multi,
      quality: 0.85,
      selectionLimit: multi ? 0 : 1,
    });
    if (result.canceled) return [];
    return result.assets.map((a) => ({
      id: makePhotoId(),
      uri: a.uri,
      width: a.width,
      height: a.height,
    }));
  };

  const addPhotos = (picked: Photo[]) => {
    if (picked.length === 0) return;
    animate();
    const next = [...photosRef.current, ...picked];
    setPhotos(next);
    setCfg((prev) => ({ ...prev, slots: syncSlots(prev, next) }));
  };

  const pickMore = async () => addPhotos(await pickAssets(true));

  const removePhoto = (id: string) => {
    animate();
    const next = photosRef.current.filter((p) => p.id !== id);
    setPhotos(next);
    setCfg((prev) => ({ ...prev, slots: syncSlots(prev, next) }));
  };

  const clearPhotos = () => {
    setPhotos([]);
    setCfg((prev) => ({
      ...prev,
      slots: syncSlots({ ...prev, slots: [] }, []),
    }));
    setSelectedSlotId(null);
  };

  // ——— Макет ———
  const goToBuilder = (cat?: ProductCategory) => {
    const list = photosRef.current;
    const category = cat ?? cfg.category;
    setCfg((prev) =>
      category === prev.category
        ? { ...prev, slots: syncSlots(prev, list) }
        : makeConfig(category, list, prev),
    );
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setBookPage(0);
    setScreen("builder");
  };

  const startFlow = async (
    category: ProductCategory = "print",
    title?: string,
  ) => {
    if (pickingPhoto.current) return;
    pickingPhoto.current = true;
    try {
      const picked = await pickAssets(true);
      if (!picked.length) return;
      setPhotos(picked);
      setScenarioTitle(title);
      setCfg(makeConfig(category, picked));
      setSelectedSlotId(null);
      setSwapSlotId(null);
      setBookPage(0);
      setEditorPanel(null);
      setScreen("builder");
    } catch {
      Alert.alert("Фото не загружены", "Попробуйте выбрать снимки ещё раз.");
    } finally {
      pickingPhoto.current = false;
    }
  };

  const updateCfg = useCallback((patch: Partial<ProductConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      if (patch.spreads !== undefined)
        next.slots = syncSlots(next, photosRef.current);
      return next;
    });
  }, []);

  const switchCategory = (id: ProductCategory) => {
    if (id === cfg.category) return;
    setCfg((prev) => makeConfig(id, photosRef.current, prev));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setBookPage(0);
  };

  const selectSlot = (id: string | null) => {
    setSelectedSlotId(id);
    if (id && cfg.category === "photobook") {
      setBookPage(pageForSlotIndex(cfg.slots.findIndex((s) => s.id === id)));
    }
  };

  const handleSlotPress = (slotId: string) => {
    if (swapSlotId && swapSlotId !== slotId) {
      swapSlots(swapSlotId, slotId);
      setSwapSlotId(null);
      selectSlot(slotId);
      return;
    }
    if (swapSlotId === slotId) {
      setSwapSlotId(null);
      return;
    }
    selectSlot(slotId);
    void replaceSlotFromGallery(slotId);
  };

  const swapSlots = (a: string, b: string) => {
    setCfg((prev) => {
      const sa = prev.slots.find((s) => s.id === a);
      const sb = prev.slots.find((s) => s.id === b);
      if (!sa || !sb) return prev;
      return {
        ...prev,
        slots: prev.slots.map((s) =>
          s.id === a
            ? { ...s, photoId: sb.photoId }
            : s.id === b
              ? { ...s, photoId: sa.photoId }
              : s,
        ),
      };
    });
  };

  const assignPhoto = (photoId: string, slotId: string) => {
    const idx = cfg.slots.findIndex((s) => s.id === slotId);
    setCfg((prev) => {
      const target = prev.slots.find((s) => s.id === slotId);
      if (!target) return prev;
      const holder = prev.slots.find(
        (s) => s.photoId === photoId && s.id !== slotId,
      );
      return {
        ...prev,
        slots: prev.slots.map((s) => {
          if (s.id === slotId) return { ...s, photoId };
          if (holder && s.id === holder.id)
            return { ...s, photoId: target.photoId };
          return s;
        }),
      };
    });
    const nextEmpty =
      cfg.slots.find((s, i) => i > idx && !s.photoId) ??
      cfg.slots.find((s) => !s.photoId && s.id !== slotId);
    selectSlot(nextEmpty ? nextEmpty.id : slotId);
  };

  const onTrayPick = (photoId: string) => {
    setSwapSlotId(null);
    if (selectedSlotId) {
      assignPhoto(photoId, selectedSlotId);
      return;
    }
    const empty = cfg.slots.find((s) => !s.photoId);
    if (empty) {
      assignPhoto(photoId, empty.id);
      return;
    }
    const holder = cfg.slots.find((s) => s.photoId === photoId);
    if (holder) selectSlot(holder.id);
  };

  const clearSelectedSlot = () => {
    if (!selectedSlotId) return;
    setCfg((prev) => ({
      ...prev,
      slots: prev.slots.map((s) =>
        s.id === selectedSlotId ? { ...s, photoId: undefined } : s,
      ),
    }));
  };

  const replaceSlotFromGallery = async (slotId: string) => {
    if (pickingPhoto.current) return;
    pickingPhoto.current = true;
    try {
      const picked = await pickAssets(false);
      if (!picked[0]) return;
      const next = [...photosRef.current, picked[0]];
      setPhotos(next);
      setCfg((prev) => ({
        ...prev,
        slots: prev.slots.map((slot) =>
          slot.id === slotId ? { ...slot, photoId: picked[0].id } : slot,
        ),
      }));
      selectSlot(slotId);
    } catch {
      Alert.alert("Фото не добавлено", "Попробуйте выбрать снимок ещё раз.");
    } finally {
      pickingPhoto.current = false;
    }
  };

  const replaceFromGallery = () => {
    const slotId =
      selectedSlotId ??
      cfg.slots.find((slot) => !slot.photoId)?.id ??
      cfg.slots[0]?.id;
    if (slotId) void replaceSlotFromGallery(slotId);
  };

  const autoArrange = () => {
    animate();
    setSwapSlotId(null);
    setSelectedSlotId(null);
    setBookPage(0);
    setCfg((prev) => ({
      ...prev,
      slots: syncSlots(
        {
          ...prev,
          slots: prev.slots.map((s) => ({ ...s, photoId: undefined })),
        },
        photosRef.current,
      ),
    }));
  };

  // ——— Расчёты ———
  const price = useMemo(() => estimatePrice(cfg), [cfg]);
  const delivery = DELIVERY_OPTIONS.find((d) => d.id === deliveryId);
  const deliveryPrice = delivery?.price ?? 0;
  const promoValid = promo.trim().toUpperCase() === PROMO_CODE;
  const discount = promoValid ? price * PROMO_DISCOUNT : 0;
  const totalPrice = price - discount + deliveryPrice;
  const filled = filledCount(cfg);
  const usedPhotoIds = new Set(cfg.slots.map((s) => s.photoId).filter(Boolean));
  const unusedPhotos = photos.length - usedPhotoIds.size;
  const emptySlots = cfg.slots.length - filled;
  const selectedSlot = cfg.slots.find((s) => s.id === selectedSlotId);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const placeOrder = () => {
    const newOrder: MockOrder = {
      id: `ord-${Math.floor(Math.random() * 9000 + 1000)}`,
      title: productTitle(cfg),
      scenario: scenarioTitle ?? "Новый заказ",
      status: "accepted",
      statusIndex: 0,
      total: totalPrice,
      previewUri: photos[0]?.uri ?? COVER_URLS[0],
      date: "Сегодня",
      items: `${photos.length} фото · ${productDetails(cfg)}`,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setPhotos([]);
    setScenarioTitle(undefined);
    setPromo("");
    setCfg(makeConfig("print", []));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setSelectedOrderId(newOrder.id);
    setScreen("orders");
    Alert.alert(
      "Заказ оформлен 🎉",
      "Спасибо! Мы уже начали готовить ваш заказ. Статус можно отслеживать здесь.",
    );
  };

  // ═════════════ Главная ═════════════
  const renderHome = () => (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeBrand}>
        <Text style={styles.brandName}>PicPac</Text>
        <Ionicons name="aperture-outline" size={24} color={colors.accent} />
      </View>
      <View style={styles.homePrints} pointerEvents="none">
        {[COVER_URLS[4], COVER_URLS[1], COVER_URLS[0]].map((uri, i) => (
          <View
            key={uri}
            style={[
              styles.homePrint,
              {
                transform: [{ rotate: `${(i - 1) * 12}deg` }],
                left: `${8 + i * 20}%`,
                top: i === 1 ? 0 : 18,
                zIndex: i === 1 ? 3 : i,
              },
            ]}
          >
            <View
              style={[
                styles.homePrintImage,
                {
                  backgroundColor: ["#D7E1D3", "#E5D8C5", "#D6DFE3"][i],
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Ionicons name="image-outline" size={36} color="#7B8C7B" />
              <Image source={{ uri }} style={StyleSheet.absoluteFill} />
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.homeHeading}>Ваши фото на бумаге</Text>
      <Text style={styles.homeDescription}>Выберите снимки для печати.</Text>
      <PrimaryButton
        label="Загрузить фото"
        icon="images-outline"
        onPress={() => startFlow("print")}
      />
      {photos.length > 0 && (
        <Pressable
          style={styles.homeContinue}
          onPress={() => setScreen("builder")}
        >
          <Text style={styles.linkText}>Продолжить мой заказ</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        style={styles.catalogLink}
        onPress={() => setEditorPanel("products")}
      >
        <View>
          <Text style={styles.settingsTitle}>Открытки, альбомы и постеры</Text>
          <Text style={styles.settingsSummary}>Посмотреть все продукты</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
    </ScrollView>
  );

  // ═════════════ Выбор фото ═════════════
  const renderPhotoPicker = () => {
    const thumb = (width - spacing.lg * 2 - 8 * 3) / 4;
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Фотографии" onBack={() => setScreen("builder")} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {photos.length === 0 ? (
            <View style={styles.dropzone}>
              <View style={styles.dropIcon}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.dropTitle}>Добавьте ваши фото</Text>
              <Text style={styles.dropText}>
                Можно выбрать сразу несколько. Макет соберётся автоматически.
              </Text>
              <PrimaryButton
                label="Выбрать из галереи"
                icon="images-outline"
                onPress={pickMore}
              />
            </View>
          ) : (
            <>
              <View style={styles.pickedHeader}>
                <Text style={styles.pickedTitle}>Выбрано: {photos.length}</Text>
                <Pressable onPress={clearPhotos} hitSlop={8}>
                  <Text style={styles.linkText}>Очистить</Text>
                </Pressable>
              </View>
              <View style={styles.thumbGrid}>
                <Pressable
                  onPress={pickMore}
                  style={[styles.thumbAdd, { width: thumb, height: thumb }]}
                >
                  <Ionicons name="add" size={26} color={colors.accent} />
                  <Text style={styles.trayAddText}>Добавить</Text>
                </Pressable>
                {photos.map((p) => (
                  <View
                    key={p.id}
                    style={[styles.thumb, { width: thumb, height: thumb }]}
                  >
                    <Image source={{ uri: p.uri }} style={styles.fill} />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => removePhoto(p.id)}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={13} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
        <View
          style={[
            styles.footerBar,
            { paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <PrimaryButton
            label="Готово"
            icon={photos.length ? "arrow-forward" : undefined}
            disabled={photos.length === 0}
            onPress={() => goToBuilder()}
          />
        </View>
      </View>
    );
  };

  // ═════════════ Настройки продукта ═════════════
  const renderPrintFinish = (category: "print" | "poster") => {
    const finish = getPrintFinish(cfg, category);
    const field = category === "print" ? "printFinish" : "posterFinish";
    const update = (patch: Partial<PrintFinish>) =>
      updateCfg({ [field]: { ...finish, ...patch } });
    const margins =
      category === "print" ? [0, 2, 5, 10, 20] : [0, 10, 20, 40, 60];
    const frames = category === "print" ? [0, 1, 2, 4] : [0, 3, 6, 10];
    const colorsFor = (kind: "marginColor" | "frameColor", title: string) => (
      <View style={styles.finishColors}>
        {PRINT_COLORS.map((color) => (
          <Pressable
            key={color.value}
            accessibilityRole="button"
            accessibilityLabel={`${title} · ${color.name}`}
            accessibilityState={{ selected: finish[kind] === color.value }}
            onPress={() => update({ [kind]: color.value })}
            style={[
              styles.finishSwatch,
              { backgroundColor: color.value },
              finish[kind] === color.value && styles.finishSwatchSelected,
            ]}
          >
            {finish[kind] === color.value && (
              <Ionicons
                name="checkmark"
                size={18}
                color={isDark(color.value) ? "#fff" : "#20372b"}
              />
            )}
          </Pressable>
        ))}
      </View>
    );
    return (
      <>
        <SettingGroup title="Поля">
          {margins.map((mm) => (
            <Chip
              key={mm}
              label={mm === 0 ? "Без полей" : `${mm} мм`}
              active={finish.margin === mm}
              onPress={() => update({ margin: mm })}
            />
          ))}
        </SettingGroup>
        {finish.margin > 0 && (
          <View style={styles.finishColorGroup}>
            <Text style={styles.inputLabel}>Цвет полей</Text>
            {colorsFor("marginColor", "Цвет полей")}
          </View>
        )}
        <SettingGroup title="Рамка" hint="Цветная линия вокруг снимка">
          {frames.map((mm) => (
            <Chip
              key={mm}
              label={mm === 0 ? "Без рамки" : `${mm} мм`}
              active={finish.frame === mm}
              onPress={() => update({ frame: mm })}
            />
          ))}
        </SettingGroup>
        {finish.frame > 0 && (
          <View style={styles.finishColorGroup}>
            <Text style={styles.inputLabel}>Цвет рамки</Text>
            {colorsFor("frameColor", "Цвет рамки")}
          </View>
        )}
      </>
    );
  };

  const renderSettings = () => {
    switch (cfg.category) {
      case "print":
        return (
          <View style={styles.settingsCard}>
            <SettingGroup title="Формат">
              {PRINT_FORMATS.map((f) => (
                <Chip
                  key={f.id}
                  label={`${f.label} · ${money(f.pricePer)}`}
                  active={cfg.printFormatId === f.id}
                  onPress={() => updateCfg({ printFormatId: f.id })}
                />
              ))}
            </SettingGroup>
            <SettingGroup title="Бумага">
              <Chip
                label="Матовая"
                active={cfg.paper === "matte"}
                onPress={() => updateCfg({ paper: "matte" })}
              />
              <Chip
                label="Глянцевая"
                active={cfg.paper === "glossy"}
                onPress={() => updateCfg({ paper: "glossy" })}
              />
            </SettingGroup>
            <SettingGroup title="Копий каждого кадра">
              {[1, 2, 3].map((n) => (
                <Chip
                  key={n}
                  label={`×${n}`}
                  active={cfg.copies === n}
                  onPress={() => updateCfg({ copies: n })}
                />
              ))}
            </SettingGroup>
            {renderPrintFinish("print")}
          </View>
        );
      case "photobook": {
        const line = BOOK_LINES.find((l) => l.id === cfg.bookLineId);
        const coverLabel = COVER_COLORS.find(
          (c) => c.id === cfg.coverColorId,
        )?.label;
        const tpl = BOOK_TEMPLATES.find((t) => t.id === cfg.bookTemplateId);
        return (
          <View style={styles.settingsCard}>
            <Text style={styles.inputLabel}>Заголовок на обложке</Text>
            <TextInput
              style={styles.input}
              value={cfg.bookTitle}
              onChangeText={(t) => updateCfg({ bookTitle: t })}
              placeholder="Например, «Лето 2026»"
              placeholderTextColor={colors.textSecondary}
              maxLength={40}
            />
            <SettingGroup title="Линейка" hint={line?.desc}>
              {BOOK_LINES.map((l) => (
                <Chip
                  key={l.id}
                  label={l.name}
                  active={cfg.bookLineId === l.id}
                  onPress={() =>
                    updateCfg({
                      bookLineId: l.id,
                      bookFormat: l.formats.includes(cfg.bookFormat)
                        ? cfg.bookFormat
                        : l.formats[0],
                    })
                  }
                />
              ))}
            </SettingGroup>
            <SettingGroup title="Формат">
              {line?.formats.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  active={cfg.bookFormat === f}
                  onPress={() => updateCfg({ bookFormat: f })}
                />
              ))}
            </SettingGroup>
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Объём</Text>
              <Text style={styles.settingGroupHint}>
                Больше разворотов — больше фото в книге
              </Text>
              <Stepper
                label={`${cfg.spreads} разворотов · ${cfg.spreads * 2 + 2} стр.`}
                onMinus={() => updateCfg({ spreads: cfg.spreads - 1 })}
                onPlus={() => updateCfg({ spreads: cfg.spreads + 1 })}
                minusDisabled={cfg.spreads <= MIN_SPREADS}
                plusDisabled={cfg.spreads >= MAX_SPREADS}
              />
            </View>
            <SettingGroup title="Цвет обложки" hint={coverLabel}>
              {COVER_COLORS.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => updateCfg({ coverColorId: c.id })}
                  style={[
                    styles.swatch,
                    { backgroundColor: c.color },
                    cfg.coverColorId === c.id && styles.swatchActive,
                  ]}
                >
                  {cfg.coverColorId === c.id ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={isDark(c.color) ? "#fff" : colors.text}
                    />
                  ) : null}
                </Pressable>
              ))}
            </SettingGroup>
            <SettingGroup title="Стиль обложки" hint={tpl?.description}>
              {BOOK_TEMPLATES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  active={cfg.bookTemplateId === t.id}
                  onPress={() => updateCfg({ bookTemplateId: t.id })}
                />
              ))}
            </SettingGroup>
          </View>
        );
      }
      case "poster":
        return (
          <View style={styles.settingsCard}>
            <SettingGroup title="Ориентация">
              <Chip
                label="Вертикальный"
                active={cfg.posterOrientation === "portrait"}
                onPress={() => updateCfg({ posterOrientation: "portrait" })}
              />
              <Chip
                label="Горизонтальный"
                active={cfg.posterOrientation === "landscape"}
                onPress={() => updateCfg({ posterOrientation: "landscape" })}
              />
            </SettingGroup>
            <SettingGroup title="Размер">
              {POSTER_SIZES.map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.label} · ${money(s.price)}`}
                  active={cfg.posterSizeId === s.id}
                  onPress={() => updateCfg({ posterSizeId: s.id })}
                />
              ))}
            </SettingGroup>
            {renderPrintFinish("poster")}
          </View>
        );
      case "postcard":
        return (
          <View style={styles.settingsCard}>
            <Text style={styles.inputLabel}>Подпись на обороте</Text>
            <TextInput
              style={[
                styles.input,
                { minHeight: 80, textAlignVertical: "top" },
              ]}
              value={cfg.postcardCaption}
              onChangeText={(t) => updateCfg({ postcardCaption: t })}
              placeholder="Тёплые слова для близкого человека"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={120}
            />
            <SettingGroup title="Стиль">
              {POSTCARD_TEMPLATES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  active={cfg.postcardTemplateId === t.id}
                  onPress={() => updateCfg({ postcardTemplateId: t.id })}
                />
              ))}
            </SettingGroup>
            <SettingGroup title="Количество">
              {[1, 5, 10].map((n) => (
                <Chip
                  key={n}
                  label={`${n} шт`}
                  active={cfg.copies === n}
                  onPress={() => updateCfg({ copies: n })}
                />
              ))}
            </SettingGroup>
          </View>
        );
      case "mini":
        return (
          <View style={styles.settingsCard}>
            <Text style={styles.settingGroupHint}>
              Фото автоматически разложены по карточкам. Нажмите на карточку в
              макете, чтобы заменить кадр.
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  // ═════════════ Макет / редактор ═════════════
  const renderBuilder = () => {
    const fixedCapacity =
      cfg.category === "photobook" ||
      cfg.category === "poster" ||
      cfg.category === "postcard";
    const settingsSummary =
      cfg.category === "print"
        ? `${PRINT_FORMATS.find((f) => f.id === cfg.printFormatId)?.label} · ${cfg.paper === "matte" ? "Матовая" : "Глянцевая"} · ${cfg.copies} коп.`
        : productDetails(cfg);
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Ваш заказ" onBack={() => setScreen("home")} />
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!previewInteracting}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.editorContent}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Изменить продукт"
            onPress={() => setEditorPanel("products")}
            style={styles.productSelector}
          >
            <View>
              <Text style={styles.productSelectorName}>
                {productTitle(cfg)}
              </Text>
              <Text style={styles.productSelectorHint}>Изменить продукт</Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
          <MotionView key={cfg.category} kind="product">
            <ProductPreview
              key={cfg.category}
              cfg={cfg}
              photos={photos}
              scene={scene}
              onMaterial={paper => updateCfg({paper})}
              onBrightness={delta => setScene(prev => ({...prev, lightBrightness: clamp(prev.lightBrightness + delta, 0, 200)}))}
              onSceneChange={updateScene}
              selectedSlotId={selectedSlotId}
              swapSlotId={swapSlotId}
              onSlotPress={handleSlotPress}
              bookPage={bookPage}
              onBookPage={setBookPage}
              onInteractionChange={handlePreviewInteraction}
              onTextPress={openTextEditor}
            />
          </MotionView>
          {swapSlotId && (
            <Notice
              tone="info"
              icon="swap-horizontal-outline"
              text="Выберите второе фото в превью"
              actionLabel="Отмена"
              onAction={() => setSwapSlotId(null)}
            />
          )}
          {fixedCapacity && (unusedPhotos > 0 || emptySlots > 0) && (
            <Pressable
              onPress={() => setEditorPanel("photos")}
              style={styles.attentionRow}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.attentionText}>
                {emptySlots > 0
                  ? `Осталось добавить фото: ${emptySlots}`
                  : `Не использовано фото: ${unusedPhotos}`}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.accent}
              />
            </Pressable>
          )}
          <View style={styles.editorOptions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Настроить печать"
              style={styles.editorOption}
              onPress={() => setEditorPanel("settings")}
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={colors.accent}
              />
              <View style={styles.optionBody}>
                <Text style={styles.settingsTitle}>Формат и оформление</Text>
                <Text style={styles.settingsSummary}>{settingsSummary}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
            <View style={styles.optionDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Управлять фото"
              style={styles.editorOption}
              onPress={() => setEditorPanel("photos")}
            >
              <Ionicons name="images-outline" size={20} color={colors.accent} />
              <View style={styles.optionBody}>
                <Text style={styles.settingsTitle}>Фотографии</Text>
                <Text style={styles.settingsSummary}>
                  {`${photos.length} фото`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </ScrollView>
        <View
          style={[
            styles.footerBar,
            styles.footerRow,
            { paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.footerPriceLabel}>К оплате</Text>
            <Text style={styles.footerPriceValue}>{money(price)}</Text>
          </View>
          <View style={{ flex: 1.2 }}>
            <PrimaryButton
              label="Оформить"
              icon="arrow-forward"
              disabled={filled === 0}
              onPress={() => setScreen("checkout")}
            />
          </View>
        </View>
      </View>
    );
  };

  // ═════════════ Оформление ═════════════
  const renderCheckout = () => (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader
        title="Доставка и оплата"
        onBack={() => setScreen("builder")}
      />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!previewInteracting}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.orderReview}
          onPress={() => setCheckoutPreviewOpen(!checkoutPreviewOpen)}
          accessibilityRole="button"
          accessibilityState={{ expanded: checkoutPreviewOpen }}
        >
          <Image
            source={{
              uri:
                photoById(photos, cfg.slots[0]?.photoId)?.uri ?? photos[0]?.uri,
            }}
            style={styles.orderReviewImage}
          />
          <View style={styles.optionBody}>
            <Text style={styles.settingsTitle}>{productTitle(cfg)}</Text>
            <Text style={styles.settingsSummary}>Проверить макет</Text>
          </View>
          <Ionicons
            name={checkoutPreviewOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
        {checkoutPreviewOpen && (
          <MotionView kind="section">
            <ProductPreview
              cfg={cfg}
              photos={photos}
              scene={scene}
              onSceneChange={updateScene}
              showSceneControls={false}
              onInteractionChange={handlePreviewInteraction}
            />
          </MotionView>
        )}

        <SectionTitle title="Доставка" />
        {DELIVERY_OPTIONS.map((d) => {
          const on = deliveryId === d.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => setDeliveryId(d.id)}
              style={[styles.optionRow, on && styles.optionRowActive]}
            >
              <Ionicons
                name={on ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={on ? colors.accent : colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{d.label}</Text>
                <Text style={styles.optionSub}>{d.eta}</Text>
              </View>
              <Text style={styles.optionPrice}>{money(d.price)}</Text>
            </Pressable>
          );
        })}

        <SectionTitle title="Оплата" />
        {PAYMENT_OPTIONS.map((p) => {
          const on = paymentId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPaymentId(p.id)}
              style={[styles.optionRow, on && styles.optionRowActive]}
            >
              <Ionicons
                name={on ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={on ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.optionLabel, { flex: 1 }]}>{p.label}</Text>
            </Pressable>
          );
        })}

        <SectionTitle title="Промокод" />
        <TextInput
          style={styles.input}
          value={promo}
          onChangeText={setPromo}
          placeholder="Введите промокод"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
        />

        <View style={styles.card}>
          <SummaryRow label="Товар" value={money(price)} />
          <SummaryRow
            label={`Доставка · ${delivery?.label ?? ""}`}
            value={money(deliveryPrice)}
          />
          {promoValid ? (
            <SummaryRow
              label="Промокод −10%"
              value={`−${money(discount)}`}
              accent
            />
          ) : null}
          <View style={styles.summaryDivider} />
          <SummaryRow label="Итого" value={money(totalPrice)} strong />
        </View>
      </ScrollView>
      <View
        style={[
          styles.footerBar,
          styles.footerRow,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.footerPriceLabel}>К оплате</Text>
          <Text style={styles.footerPriceValue}>{money(totalPrice)}</Text>
        </View>
        <View style={{ flex: 1.2 }}>
          <PrimaryButton label="Оформить заказ" onPress={placeOrder} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // ═════════════ Заказы ═════════════
  const renderOrders = () => (
    <View style={styles.flex}>
      <ScreenHeader
        title={selectedOrder ? "Заказ" : "Заказы"}
        onBack={selectedOrder ? () => setSelectedOrderId(null) : undefined}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {selectedOrder ? (
          <>
            <OrderCard order={selectedOrder} />
            <SectionTitle title="Статус заказа" />
            <View style={styles.card}>
              <StatusTimeline activeIndex={selectedOrder.statusIndex} />
            </View>
            <View style={styles.card}>
              <Text style={styles.checkoutLine}>Детали</Text>
              <Text style={styles.checkoutMeta}>{selectedOrder.items}</Text>
              <Text style={styles.checkoutMeta}>№ {selectedOrder.id}</Text>
            </View>
            <PrimaryButton
              label="Повторить заказ"
              icon="refresh-outline"
              variant="secondary"
              onPress={() => startFlow(undefined, selectedOrder.scenario)}
            />
          </>
        ) : (
          <>
            {orders[0] ? (
              <>
                <SectionTitle title="Активный заказ" />
                <OrderCard
                  order={orders[0]}
                  onPress={() => setSelectedOrderId(orders[0].id)}
                />
                <View style={styles.card}>
                  <StatusTimeline activeIndex={orders[0].statusIndex} />
                </View>
              </>
            ) : null}
            <SectionTitle title="История" />
            {orders.slice(1).map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onPress={() => setSelectedOrderId(o.id)}
                onRepeat={() => startFlow(undefined, o.scenario)}
              />
            ))}
          </>
        )}
      </ScrollView>
      <BottomNav
        active="orders"
        onHome={() => {
          setSelectedOrderId(null);
          setScreen("home");
        }}
        onOrders={() => setSelectedOrderId(null)}
        onProfile={() => setScreen("profile")}
      />
    </View>
  );

  // ═════════════ Профиль ═════════════
  const renderProfile = () => (
    <View style={styles.flex}>
      <ScreenHeader title="Профиль" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>PP</Text>
          </View>
          <Text style={styles.profileName}>Мой профиль</Text>
          <Text style={styles.profileMeta}>Заказов: {orders.length}</Text>
        </View>
        <SectionTitle title="О приложении" />
        <Text style={styles.profileText}>
          PicPac — печать фото без лишних шагов: выберите снимки, посмотрите
          готовый макет и оформите заказ с доставкой.
        </Text>
      </ScrollView>
      <BottomNav
        active="profile"
        onHome={() => setScreen("home")}
        onOrders={() => setScreen("orders")}
        onProfile={() => {}}
      />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Modal
        visible={editorPanel !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorPanel(null)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Закрыть панель"
            onPress={() => setEditorPanel(null)}
          />
          <MotionView
            key={panelContent}
            kind="panel"
            style={[styles.sheetCard, { paddingBottom: insets.bottom + 12 }]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {panelContent === "products"
                  ? "Что напечатать?"
                  : panelContent === "settings"
                    ? "Формат и оформление"
                    : "Ваши фотографии"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть панель"
                onPress={() => setEditorPanel(null)}
                style={styles.sheetClose}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {panelContent === "products" && (
                <>
                  {PRODUCT_TABS.map((product) => (
                    <Pressable
                      key={product.id}
                      accessibilityRole="button"
                      onPress={() => {
                        if (screen === "home") void startFlow(product.id);
                        else {
                          setEditorPanel(null);
                          switchCategory(product.id);
                        }
                      }}
                      style={styles.catalogProduct}
                    >
                      <View style={styles.catalogProductIcon}>
                        <Ionicons
                          name={product.icon}
                          size={25}
                          color={colors.accent}
                        />
                      </View>
                      <View style={styles.optionBody}>
                        <Text style={styles.settingsTitle}>
                          {product.label}
                        </Text>
                        <Text style={styles.settingsSummary}>
                          {product.blurb} · {product.from}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          screen !== "home" && cfg.category === product.id
                            ? "checkmark"
                            : "chevron-forward"
                        }
                        size={18}
                        color={colors.accent}
                      />
                    </Pressable>
                  ))}
                  <Text style={styles.sheetSectionTitle}>Идеи для подарка</Text>
                  {SCENARIOS.map((scenario) => (
                    <Pressable
                      key={scenario.id}
                      style={styles.scenarioOption}
                      onPress={() => {
                        if (screen === "home")
                          void startFlow(
                            HINT_TO_CATEGORY[scenario.productHint],
                            scenario.title,
                          );
                        else {
                          setEditorPanel(null);
                          setScenarioTitle(scenario.title);
                          switchCategory(
                            HINT_TO_CATEGORY[scenario.productHint],
                          );
                        }
                      }}
                    >
                      <Image
                        source={{ uri: scenario.cover }}
                        style={styles.scenarioThumb}
                      />
                      <View style={styles.optionBody}>
                        <Text style={styles.settingsTitle}>
                          {scenario.title}
                        </Text>
                        <Text style={styles.settingsSummary}>
                          {scenario.subtitle}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  ))}
                </>
              )}
              {panelContent === "settings" && renderSettings()}
              {panelContent === "photos" && (
                <>
                  <PhotoTray
                    photos={photos}
                    slots={cfg.slots}
                    selectedPhotoId={selectedSlot?.photoId}
                    hasSelection={!!selectedSlotId}
                    onPick={onTrayPick}
                    onAdd={pickMore}
                  />
                  {selectedSlotId && (
                    <View style={styles.actionRow}>
                      <ActionTile
                        icon="images-outline"
                        label="Заменить"
                        onPress={replaceFromGallery}
                      />
                      <ActionTile
                        icon="swap-horizontal-outline"
                        label="Поменять"
                        disabled={!selectedSlotId}
                        onPress={() => {
                          setSwapSlotId(selectedSlotId);
                          setEditorPanel(null);
                        }}
                      />
                      <ActionTile
                        icon="trash-outline"
                        label="Убрать"
                        disabled={!selectedSlot?.photoId}
                        onPress={clearSelectedSlot}
                      />
                    </View>
                  )}
                  <Pressable
                    style={styles.catalogProduct}
                    onPress={autoArrange}
                  >
                    <Ionicons
                      name="color-wand-outline"
                      size={22}
                      color={colors.accent}
                    />
                    <View style={styles.optionBody}>
                      <Text style={styles.settingsTitle}>
                        Разложить автоматически
                      </Text>
                      <Text style={styles.settingsSummary}>
                        Заполнить макет выбранными снимками
                      </Text>
                    </View>
                  </Pressable>
                  {cfg.category === "photobook" &&
                    unusedPhotos > 0 &&
                    cfg.spreads < MAX_SPREADS && (
                      <PrimaryButton
                        label="Добавить развороты"
                        onPress={() =>
                          updateCfg({
                            spreads: Math.min(
                              MAX_SPREADS,
                              cfg.spreads + Math.ceil(unusedPhotos / 2),
                            ),
                          })
                        }
                      />
                    )}
                  <Pressable
                    style={styles.catalogProduct}
                    onPress={() => {
                      setEditorPanel(null);
                      setScreen("photoPicker");
                    }}
                  >
                    <Ionicons
                      name="grid-outline"
                      size={22}
                      color={colors.accent}
                    />
                    <Text style={styles.settingsTitle}>
                      Выбрать и удалить снимки
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </>
              )}
            </ScrollView>
            {panelContent !== "products" && (
              <View style={styles.sheetFooter}>
                <PrimaryButton
                  label="Готово"
                  onPress={() => setEditorPanel(null)}
                />
              </View>
            )}
          </MotionView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={textEditing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTextEditing(null)}
      >
        <KeyboardAvoidingView
          style={styles.textEditorBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Закрыть ввод текста"
            onPress={() => setTextEditing(null)}
          />
          <MotionView kind="panel" style={styles.textEditorCard}>
            <Text style={styles.settingsTitle}>
              {textField === "bookTitle"
                ? "Название альбома"
                : "Текст открытки"}
            </Text>
            <TextInput
              autoFocus
              multiline
              value={textDraft}
              onChangeText={setTextDraft}
              accessibilityLabel="Текст для печати"
              placeholder="Напишите что-нибудь тёплое"
              maxLength={textField === "bookTitle" ? 60 : 140}
              style={styles.textEditorInput}
            />
            <View style={styles.textEditorActions}>
              <Pressable
                style={styles.zoomButton}
                onPress={() => setTextEditing(null)}
              >
                <Text style={styles.linkText}>Отмена</Text>
              </Pressable>
              <PrimaryButton
                label="Сохранить текст"
                onPress={() => {
                  if (textEditing) updateCfg({ [textEditing]: textDraft });
                  setTextEditing(null);
                }}
              />
            </View>
          </MotionView>
        </KeyboardAvoidingView>
      </Modal>

      <MotionView key={screen} kind="screen" style={styles.flex}>
        {screen === "home" && renderHome()}
        {screen === "photoPicker" && renderPhotoPicker()}
        {screen === "builder" && renderBuilder()}
        {screen === "checkout" && renderCheckout()}
        {screen === "orders" && renderOrders()}
        {screen === "profile" && renderProfile()}
      </MotionView>
      {screen === "home" ? (
        <BottomNav
          active="home"
          onHome={() => {}}
          onOrders={() => setScreen("orders")}
          onProfile={() => setScreen("profile")}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={[]}>
        <PicPacApp />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ═══════════════════════════ Стили ═══════════════════════════
const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const styles = StyleSheet.create({
  orderReview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderReviewImage: { width: 44, height: 58, borderRadius: 4 },

  homeBrand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    marginBottom: 24,
  },
  brandName: {
    fontSize: 25,
    letterSpacing: -1,
    fontWeight: "800",
    color: colors.accent,
  },
  homePrints: { height: 204, marginVertical: 12 },
  homePrint: {
    width: "45%",
    height: 180,
    position: "absolute",
    padding: 7,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
  },
  homePrintImage: { width: "100%", height: "100%" },
  homeHeading: {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.5,
    fontWeight: "700",
    color: colors.text,
    marginTop: 16,
  },
  homeDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 24,
  },
  homeContinue: { paddingVertical: 18, alignItems: "center" },
  catalogLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 22,
    marginTop: 24,
  },
  editorContent: { paddingHorizontal: 16, paddingBottom: 24 },
  productSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 16,
    marginBottom: 4,
  },
  productSelectorName: {
    fontSize: 23,
    letterSpacing: -0.6,
    fontWeight: "700",
    color: colors.text,
  },
  productSelectorHint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  editorOptions: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  editorOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    gap: 14,
  },
  optionBody: { flex: 1 },
  optionDivider: { height: 1, backgroundColor: colors.border, marginLeft: 51 },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    marginTop: 8,
  },
  attentionText: { flex: 1, fontSize: 13, color: colors.accent },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(23,37,28,.38)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    maxHeight: "90%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    letterSpacing: -0.6,
    fontWeight: "700",
    color: colors.text,
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8ECE5",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12 },
  catalogProduct: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 8,
  },
  catalogProductIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginTop: 20,
    marginBottom: 14,
    paddingLeft: 4,
  },
  scenarioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  scenarioThumb: { width: 48, height: 56, borderRadius: 8 },

  viewerBounds: {
    height: PREVIEW_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },
  gestureSurface: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    backgroundColor: "transparent",
  },

  finishColors: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  finishColorGroup: { marginBottom: 16, gap: 4 },
  finishSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CED5CC",
    justifyContent: "center",
    alignItems: "center",
  },
  finishSwatchSelected: { borderWidth: 2, borderColor: colors.accent },

  zoomButton: {
    minWidth: 42,
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 21,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  textEditorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,32,26,.38)",
    justifyContent: "center",
    padding: 24,
  },
  textEditorCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    gap: 16,
  },
  textEditorInput: {
    minHeight: 120,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 17,
    textAlignVertical: "top",
  },
  textEditorActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  objectPreview: {
    backgroundColor: "#fff",
    borderRadius: 24,
    marginBottom: 8,
    overflow: "hidden",
  },
  objectStage: {
    zIndex: 0,
    height: PREVIEW_HEIGHT,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  sceneLightMarker: {
    position: "absolute",
    top: 14,
    zIndex: 3000,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  sceneControls: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 10,
    backgroundColor: "#fff",
  },
  sceneControlsTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sceneControlLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginTop: 4 },
  sceneChoices: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  sceneSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sceneSwatchActive: { borderWidth: 2, borderColor: colors.accent },
  sceneColorInput: {
    minWidth: 100,
    height: 36,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    fontSize: 13,
  },
  objectPlane: { position: "absolute", overflow: "hidden" },
  spineTitle: { fontSize: 8, paddingTop: 16, textAlign: "center" },
  pageEdges: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#F9F7EF",
    backgroundColor: "#DED9CD",
  },
  surfacePhoto: { flex: 1, borderRadius: 0, borderWidth: 0 },
  surfacePrint: { flex: 1, backgroundColor: "#fffdfa" },
  surfaceCover: {
    flex: 1,
    padding: 12,
    borderLeftWidth: 6,
    borderLeftColor: "rgba(0,0,0,.12)",
  },
  surfaceCoverPhoto: { flex: 1, overflow: "hidden" },
  surfaceTitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingTop: 12,
    paddingBottom: 2,
  },
  coverRule: {
    alignSelf: "center",
    width: 24,
    height: 1,
    backgroundColor: "#948e80",
    marginTop: 5,
  },
  surfaceSpread: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fffdfa",
    padding: 6,
    gap: 8,
  },
  surfacePage: { flex: 1 },
  surfaceFold: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 2,
    backgroundColor: "#cec9bd",
  },
  surfaceBack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  cardReverse: { flex: 1, padding: 14, gap: 14 },
  reverseTop: { flexDirection: "row", justifyContent: "space-between" },
  reverseCaption: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },
  previewNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 12,
  },
  previewArrow: { padding: 10 },
  previewPageLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  previewSides: { flexDirection: "row", gap: 8 },
  previewSide: { paddingHorizontal: 14, paddingVertical: 10 },
  settingsTitle: { fontSize: 15, color: colors.text, fontWeight: "600" },
  settingsSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    maxWidth: 260,
  },

  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  fill: { width: "100%", height: "100%" },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
  },
  btnFill: { backgroundColor: colors.accent, ...shadow, shadowOpacity: 0.12 },
  btnOutline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: { backgroundColor: "#E5E0DA", shadowOpacity: 0, elevation: 0 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  btnText: { fontSize: 16, fontWeight: "700" },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
  chipTextActive: { color: colors.accent },
  linkText: { color: colors.accent, fontWeight: "700", fontSize: 14 },

  sectionTitleWrap: { marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  sectionSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerSide: { width: 88 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  screenHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },

  bottomNav: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    ...shadow,
    shadowOpacity: 0.1,
    elevation: 6,
  },
  bottomNavItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  bottomNavLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  dropzone: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#F2C9A5",
    padding: spacing.lg,
    gap: 6,
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  dropTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  dropText: {
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  pickedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  pickedTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: {
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  thumbAdd: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  footerBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  footerPriceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  footerPriceValue: { fontSize: 20, fontWeight: "800", color: colors.text },

  slot: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#F2EEE9",
  },
  slotSelected: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  slotSwap: { borderColor: colors.accentYellow, borderStyle: "dashed" },
  cropBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#F7F4F0",
  },
  emptySlotText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  postcardStamp: {
    width: 26,
    height: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textSecondary,
    borderRadius: 3,
    opacity: 0.6,
  },
  postcardLine: { height: 1, backgroundColor: colors.border },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  noticeInfo: { backgroundColor: colors.accentSoft },
  noticeWarn: { backgroundColor: "#FFF0F0" },
  noticeText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  noticeAction: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeActionText: { fontSize: 12, fontWeight: "800", color: colors.accent },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionTileActive: { borderColor: colors.accent, backgroundColor: "#FFFAF6" },
  actionTileLabel: { fontSize: 11, fontWeight: "700", color: colors.text },

  trayWrap: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trayTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  trayHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  trayRow: { gap: 8, paddingRight: spacing.sm },
  trayAdd: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  trayAddText: { fontSize: 10, fontWeight: "700", color: colors.accent },
  trayThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.border,
  },
  trayThumbSelected: { borderColor: colors.accent },
  trayBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  settingGroup: { marginBottom: spacing.md },
  settingGroupTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  settingGroupHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  settingGroupChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnOff: { opacity: 0.35 },
  stepperLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchActive: { borderColor: colors.accent },

  checkoutLine: { fontSize: 17, fontWeight: "800", color: colors.text },
  checkoutMeta: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: { borderColor: colors.accent, backgroundColor: "#FFF9F4" },
  optionLabel: { fontWeight: "700", color: colors.text, fontSize: 15 },
  optionSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  optionPrice: { color: colors.textSecondary, fontWeight: "600" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryLabel: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  summaryStrong: { color: colors.text, fontSize: 18, fontWeight: "800" },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },

  orderCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 112,
  },
  orderCardImage: { width: 104, alignSelf: "stretch" },
  orderCardBody: { flex: 1, padding: spacing.md },
  orderCardTitle: { fontWeight: "800", color: colors.text, fontSize: 15 },
  orderCardMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  orderCardItems: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  orderCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  orderCardPrice: { fontWeight: "800", color: colors.text },
  orderStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: "50%",
  },
  orderStatusText: { fontSize: 11, fontWeight: "700" },
  orderRepeatText: { color: colors.accent, fontWeight: "700", fontSize: 13 },

  timeline: { flexDirection: "row" },
  timelineStep: { flex: 1, alignItems: "center" },
  timelineDotRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  timelineBar: { flex: 1, height: 3, backgroundColor: colors.border },
  timelineBarDone: { backgroundColor: colors.accentYellow },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  timelineDotDone: { backgroundColor: colors.accentYellow },
  timelineDotCurrent: {
    backgroundColor: colors.accent,
    transform: [{ scale: 1.3 }],
  },
  timelineLabel: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    minHeight: 24,
  },

  profileCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFE6D4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  profileAvatarText: { fontWeight: "800", color: colors.accent, fontSize: 22 },
  profileName: { fontSize: 18, fontWeight: "800", color: colors.text },
  profileMeta: { color: colors.textSecondary, marginTop: 4 },
  profileText: { color: colors.textSecondary, lineHeight: 22, fontSize: 15 },
});
