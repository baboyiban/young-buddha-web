export interface ComponentOptions {
  id: string;
  file: string;
  callback?: () => void;
  container?: string;
}

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

export async function loadComponents(
  components: ComponentOptions[],
): Promise<void> {
  const promises = components.map(({ id, file, callback }) =>
    includeComponent(id, file, callback),
  );
  await Promise.allSettled(promises);
}
