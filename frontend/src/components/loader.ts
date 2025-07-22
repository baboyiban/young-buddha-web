import type { ComponentOptions } from "./types";

/**
 * 지정한 id의 엘리먼트에 외부 HTML 컴포넌트를 동적으로 삽입합니다.
 */
export async function includeComponent(
  id: string,
  file: string,
  callback?: () => void,
): Promise<void> {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`Component with id "${id}" not found`);
    return;
  }
  try {
    const response = await fetch(`/components/${file}`);
    if (!response.ok)
      throw new Error(`Failed to load component: ${response.statusText}`);
    const html = await response.text();
    el.innerHTML = html;
    callback?.();
  } catch (error) {
    console.error(`Error loading component "${id}":`, error);
  }
}

/**
 * 여러 컴포넌트를 병렬로 로드합니다.
 */
export async function loadComponents(
  components: ComponentOptions[],
): Promise<void> {
  const promises = components.map(({ id, file, callback }) =>
    includeComponent(id, file, callback),
  );
  await Promise.allSettled(promises);
}
