import { apiClient } from "../lib/api";
import type { AbsenceRequest } from "../types/payment";

export function setupPaymentPage() {
  // 결재 요청 목록 불러오기
  async function loadPayments() {
    const listDiv = document.getElementById("payment-list")!;
    listDiv.innerHTML = "불러오는 중...";
    try {
      const payments: AbsenceRequest[] = await apiClient.get(
        "/api/payment?last_n=10",
      );
      if (!payments.length) {
        listDiv.innerHTML = "결재 요청이 없습니다.";
        return;
      }
      listDiv.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>이름</th><th>유형</th><th>신청일</th><th>불참일</th><th>시간대</th><th>사유</th><th>상태</th>
            </tr>
          </thead>
          <tbody>
            ${payments
              .map(
                (p) => `
              <tr>
                <td>${p.name}</td>
                <td>${p.type}</td>
                <td>${p.request_date}</td>
                <td>${p.absent_date}</td>
                <td>${p.time_slot ?? ""}</td>
                <td>${p.reason ?? ""}</td>
                <td>${p.status}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } catch (e) {
      listDiv.innerHTML = "불러오기 실패";
    }
  }

  // 결재 요청 등록 (이벤트 리스너 중복 방지)
  const form = document.getElementById(
    "payment-form",
  ) as HTMLFormElement | null;
  if (form) {
    // 기존 폼을 복제해서 모든 이벤트 리스너 제거
    const newForm = form.cloneNode(true) as HTMLFormElement;
    form.parentNode?.replaceChild(newForm, form);

    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(newForm).entries());
      try {
        await apiClient.post("/api/payment", data);
        alert("신청 완료!");
        newForm.reset();
        loadPayments();
      } catch (e) {
        alert("신청 실패");
      }
    });
  }

  // 페이지 진입 시 목록 로드
  loadPayments();
}
