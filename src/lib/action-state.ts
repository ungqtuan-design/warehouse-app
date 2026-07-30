export type FormActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const idleFormActionState: FormActionState = {
  status: "idle",
  message: "",
};