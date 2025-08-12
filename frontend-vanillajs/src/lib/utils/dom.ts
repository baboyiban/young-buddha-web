/**
 * DOM 조작을 위한 유틸리티 함수들
 */

export class DOMUtils {
  /**
   * 안전하게 DOM 요소를 가져옵니다
   */
  static getElementById<T extends HTMLElement = HTMLElement>(
    id: string,
    required: true
  ): T;
  static getElementById<T extends HTMLElement = HTMLElement>(
    id: string,
    required?: false
  ): T | null;
  static getElementById<T extends HTMLElement = HTMLElement>(
    id: string,
    required = false
  ): T | null {
    const element = document.getElementById(id) as T | null;

    if (required && !element) {
      throw new Error(`Required element with id "${id}" not found`);
    }

    return element;
  }

  /**
   * 요소의 내용을 안전하게 설정합니다
   */
  static setContent(elementOrId: string | HTMLElement, content: string): void {
    const element =
      typeof elementOrId === "string"
        ? this.getElementById(elementOrId)
        : elementOrId;

    if (element) {
      element.innerHTML = content;
    }
  }

  /**
   * 요소의 텍스트를 안전하게 설정합니다
   */
  static setText(elementOrId: string | HTMLElement, text: string): void {
    const element =
      typeof elementOrId === "string"
        ? this.getElementById(elementOrId)
        : elementOrId;

    if (element) {
      element.textContent = text;
    }
  }

  /**
   * 폼 데이터를 객체로 변환합니다
   */
  static formToObject(form: HTMLFormElement): Record<string, string> {
    const formData = new FormData(form);
    return Object.fromEntries(formData.entries()) as Record<string, string>;
  }

  /**
   * 요소가 존재하는지 확인합니다
   */
  static exists(id: string): boolean {
    return document.getElementById(id) !== null;
  }

  /**
   * 여러 요소를 한번에 가져옵니다
   */
  static getElements<T extends Record<string, string>>(
    ids: T
  ): { [K in keyof T]: HTMLElement | null } {
    const result = {} as { [K in keyof T]: HTMLElement | null };

    for (const [key, id] of Object.entries(ids)) {
      result[key as keyof T] = document.getElementById(id);
    }

    return result;
  }
}
