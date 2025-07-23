import { apiClient } from "../lib/api";
import type { AbsenceRequest } from "../types/payment";

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

// 결재 요청 등록
document
  .getElementById("payment-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await apiClient.post("/api/payment", data);
      alert("신청 완료!");
      form.reset();
      loadPayments();
    } catch (e) {
      alert("신청 실패");
    }
  });

// 페이지 진입 시 목록 로드
loadPayments();
