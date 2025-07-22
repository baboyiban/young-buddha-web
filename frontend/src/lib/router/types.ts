export interface PageInfo {
  title: string;
  file: string;
  roles?: string[];
  bindFn?: () => void | Promise<void>;
  authRequired?: boolean;
}
