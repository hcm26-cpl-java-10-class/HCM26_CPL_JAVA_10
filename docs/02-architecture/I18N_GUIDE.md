# I18N Guide — Quy uoc cho module moi

Huong dan nay mo ta cach viet code moi de chay dong bo, tu dong dich ma khong can hardcode lai tung cho.

## 1. Tong quan

He thong i18n co 3 tang, tang nao cung tu dong ap dung cho module moi:

1. Dictionary (`frontend/src/i18n/phrases.ts`) — tra chuoi English -> Viet qua key English.
2. DOM translator (`frontend/src/i18n/DomTranslator.tsx`) — quet text node va attribute
   (`placeholder`, `title`, `aria-label`, `alt`) trong `document.body`, gui chuoi chua co
   trong dictionary len backend de dich va ghi de trong DOM.
3. Format toolkit (`frontend/src/i18n/format.ts`) — nguon duy nhat cho locale va dinh
   dang ngay/so.

Ket qua: mot chuc nang moi them text tieng Viet vao component se duoc dich sang tieng Anh
va nguoc lai, ke ca text co bien, ma khong can sua component nao.

## 2. Nguyen tac bat buoc

| Nhuom | Cach dung | Sai lam khi |
|---|---|---|
| Text co dinh | `t("Save")` hoac viet chuoi English thuan, them dictionary | Viet truc tiep tieng Viet trong JSX |
| Ngay / gio / so | `useLocaleFormat()` hoac `formatDateNow` / `formatNumberNow` | `toLocaleString("vi-VN")` hardcode |
| Du lieu nghiep vu | them `data-no-translate` vao wrapper | De may dich ten khóa hoc, email, ma |
| Chart | truyen nhan da dich qua props | De DOM translator sua text trong SVG |

## 3. Text co dinh

Dung `useTranslation()` khi chuoi can bien:

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();

<span>{t("Student count")}</span>;
```

`i18next` dung natural-key: khoa chinh la chuoi English. Chuoi chua co trong dictionary
van hien thi dung nhu viet, nen khong bi loi.

Neu mot chuoi moi can dich Chat tieng Viet, them mot dong vao `phrases.ts`:

```
Student count | So hoc vien
```

Khong sua component.

## 4. Ngay, gio va so

Component dung hook (tu render lai khi doi ngon ngu):

```tsx
import { useLocaleFormat } from "@/i18n/format";

const { formatDate, formatDateTime, formatNumber } = useLocaleFormat();

<span>{formatDate(row.startDate)}</span>
<span>{formatNumber(row.total)}</span>
```

Utility khong phai React (schema, helper) dung ham runtime:

```ts
import { formatDateTimeNow, formatNumberNow } from "@/i18n/format";

const label = formatDateTimeNow(value);
const total = formatNumberNow(count);
```

Khi can dinh dang ngay tuy chon rieng, dung `formatDateCustomNow` / `formatDateTimeCustomNow`
voi `Intl.DateTimeFormatOptions`. Locale lay theo ngon ngu hien tai.

> Khong hardcode `"vi-VN"`, `"en-GB"`, `"en-US"` trong bất kỳ file nao.
> `LOCALE_BY_LANGUAGE` trong `frontend/src/i18n/format.ts` la nguon duy nhat.

## 5. Bao ve du lieu nghiep vu

DOM translator quet toan bo `document.body`. Du lieu lay tu DB (ten nguoi, ten khoa hoc,
email, ma, noi dung nguoi dung nhap) **khong duoc dich**, vi provider dich se lam hong
gia tri (vi du `admin@example.com` -> `quan tri vien@example.com`).

Quy tac:

- Component hien thi gia tri o bang (`TruncatedText`), the badges (`BadgeList`,
  `OverflowBadges`), gia tri relation (`CardFieldValue`) da co san `data-no-translate`.
- Neu tu viet component hien thi du lieu, them `data-no-translate` vao wrapper:

```tsx
<div data-no-translate>{record.name}</div>
```

- Nhan enum/boolean cua he thong thi DUNG dich: chuyen sang `t()`.

```tsx
const label = t(value ? "Yes" : "No");
```

## 6. Chart

Recharts ve bang SVG. DOM translator da bo qua `svg` va `.recharts-wrapper`, nen khong
can them `data-no-translate` tung chart. Tuy vay:

- Truyen nhan da dich qua props: `tooltipNumber(value, t("Learners"))`.
- Dung `formatNumber` / `formatPercent` tu `chart-helpers.ts` de so co dau phan cach
  theo locale.

## 7. Backend

| Endpoint | Muc dich |
|---|---|
| `POST /api/i18n/translate` | Dich danh sach chuoi sang ngon ngu dich |
| `GET /api/i18n/languages` | Danh sach ngon ngu backend that su dich duoc |

Ma loi on dinh:

| Ma | HTTP | Nghia |
|---|---|---|
| `ERR_I18N_UNSUPPORTED_LANGUAGE` | 400 | Ngon ngu dich khong duoc ho tro |
| `ERR_I18N_TOO_MANY_TEXTS` | 400 | Vuot gioi han so chuoi mot request |
| `ERR_I18N_RATE_LIMITED` | 429 | Qua gioi han request/phut (co header `Retry-After`) |

Tat ca loi i18n duoc xu ly trong `GlobalExceptionHandler` — khong tao advice rieng.

Cache dich luu trong bang `i18n_translation_cache`, khong xoa khi deploy.

## 8. Checklist khi them module moi

- [ ] Khong hardcode locale trong `toLocaleString` / `new Intl.*`.
- [ ] Ngay/so dung `useLocaleFormat()` hoac ham runtime tu `@/i18n/format`.
- [ ] Text co bien dung `t()`; text co dinh them vao `phrases.ts` neu can.
- [ ] Du lieu nghiep vu co `data-no-translate`.
- [ ] Khong tao `LanguageSwitcher` hay observer rieng — dung cai san.
- [ ] Khong sua `frontend/src/i18n/languages.ts` neu chi them chuoi (chi doi `LANGUAGES` khi
      them ngon ngu moi).

## 9. Them ngon ngu moi

1. `frontend/src/i18n/languages.ts`: them vao `LANGUAGES` voi `enabled: false` truoc.
2. `frontend/src/i18n/phrases.ts`: them dictionary tuong ung.
3. `backend/.../system/i18n/I18nLanguages.java`: them vao `KNOWN_TARGETS`.
4. Backend provider phai ho tro ngon ngu do.
5. Khi san xuat, dat `enabled: true` va them `app.i18n.supported-targets` trong
   `backend/src/main/resources/application.properties`.
