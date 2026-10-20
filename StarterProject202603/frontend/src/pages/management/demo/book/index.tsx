import { bookApi } from "@/api";
import { BookCreatePage } from "./pages/BookCreatePage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { BookEditPage } from "./pages/BookEditPage";
import { BookWebsiteCard } from "./components/BookWebsiteCard";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const bookSchema: EntitySchema = {
  entityName: "book",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
    },
    {
      name: "scores",
      label: "Score",
      type: "dynamic",
      dynamic: {
        valueType: "number",
        keyLabelMap: {
          midterm: "Midterm",
          final: "Final",
        },
      },
      editable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Book",
  path: "/books",
  api: bookApi,
  schema: bookSchema,
  actionPages: {
    create: {
      path: "/books/create",
      component: BookCreatePage,
    },
    edit: {
      path: "/books/:id/edit",
      component: BookEditPage,
    },
    detail: {
      path: "/books/:id/detail",
      component: BookDetailPage,
    },
  },
  cardRenderer: (props) => <BookWebsiteCard {...props} />,
};
