import { readSpreadsheetData, calculateRowFromDate, type SpreadsheetConfig } from './spreadsheet';

export async function loadHomeSheetData() {
  const resultDiv = document.getElementById("sheet-home-result");
  if (!resultDiv) return;

  resultDiv.innerHTML = "데이터를 불러오는 중...";

  try {
    // 기준일과 기준 행 설정 (2025년 7월 17일을 159행으로 설정)
    const baseDate = "2025-07-17";
    const baseRow = 159;
    const currentRow = calculateRowFromDate(baseDate, baseRow);

    const config: SpreadsheetConfig = {
      spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
      range: `[NEW] 생활소임_2학기!A${currentRow}:R${currentRow}`
    };

    const data = await readSpreadsheetData(config);

    if (data.length === 0) {
      resultDiv.innerHTML = "데이터가 없습니다.";
      return;
    }

    // 첫 번째 행의 데이터만 표시 (빈 셀도 포함)
    const firstRow = data[0];
    const items = firstRow.map((cell: string) => cell && cell !== '-' ? cell : '');

    const html = `
    <div class="flex flex-col items-center justify-center h-full
    *:mb-[1rem] *:text-center *:*:mb-[0.5rem]
    ">
      <div class="">🌴${items[0]} ${items[1]}요일 청년붓다 소임🌴</div>
      
      <div>
        <div>🍚 발우공양 당번</div>
        <div>${[items[2], items[3]].filter(v => v).join(', ')}</div>
      </div>
      
      <div>
        <div>🤲 발우공양 바라지</div>
        <div>${[items[4], items[5]].filter(v => v).join(', ')}</div>
      </div>
      
      <div>
        <div>🧼 아침 설거지</div>
        <div>${[items[6], items[7], items[8]].filter(v => v).join(', ')}</div>
      </div>
      
      <div>
        <div>🧺 걸레빨기</div>
        <div>${[
        items[9] ? `(애벌/세탁) ${items[9]}` : '',
        items[10] ? `(널기) ${items[10]}` : '',
        items[11] ? `(걷고/개기) ${items[11]}` : ''
      ].filter(v => v).join(', ')}</div>
      </div>
      
      <div>
        <div>🌞 사시예불전 방석깔기</div>
        <div>${[
        items[12] || (items[12] === '' ? '' : '상근자 전원'),
        items[13]
      ].filter(v => v).join(', ')}</div>
      </div>
      
      <div>
        <div>🍛 저녁공양 당번</div>
        <div>${[items[14], items[15], items[16]].filter(v => v).join(', ')}</div>
      </div>
      
      <div>
        <div>🌚 저녁예불 방석 한줄깔기</div>
        <div>${items[17]}</div>
      </div>
    </div>
`;

    resultDiv.innerHTML = html;

  } catch (error) {
    console.error('스프레드시트 로드 오류:', error);
  }
}