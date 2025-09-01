"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);


  return (
    <div className="flex items-center justify-center">
      <div className="flex flex-col items-center space-y-[0.5rem]">
        {/* 현재 상태 정보 */}
        {/*<div className="text-sm text-gray-50">
          총 <span className="font-medium text-blue-600">{totalItems}</span>개
          중 <span className="font-medium text-blue-600">{startItem}</span>-
          <span className="font-medium text-blue-600">{endItem}</span>개 표시
          (페이지 {currentPage}/{totalPages})
        </div>*/}

        {/* 페이지네이션 버튼들 */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-[0.25rem]">
            {/* 이전 페이지 */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="button small gray"
            >
              이전
            </button>

            {/* 페이지 번호들 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`button small ${pageNum === currentPage ? "purple" : ""}`}
                >
                  {pageNum}
                </button>
              ),
            )}

            {/* 다음 페이지 */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="button small gray"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
