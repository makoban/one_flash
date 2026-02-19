/**
 * ProgressBar コンポーネント
 *
 * 3ステップのフォーム進捗を視覚的に表示する。
 *
 * @example
 * <ProgressBar currentStep={2} totalSteps={3} />
 */

"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function ProgressBar({
  currentStep,
  totalSteps,
  stepLabels,
}: ProgressBarProps) {
  const defaultLabels = ["サイト情報入力", "カラーテーマ選択", "確認・決済"];
  const labels = stepLabels ?? defaultLabels;

  return (
    <div className="w-full px-4 py-6">
      {/* ステップインジケーター */}
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={stepNumber} className="flex items-center flex-1">
              {/* ステップサークル */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-indigo-600 text-white"
                        : isCurrent
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                        : "bg-gray-100 text-gray-400"
                    }
                  `}
                >
                  {isCompleted ? (
                    // チェックマーク
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                {/* ステップラベル */}
                <span
                  className={`
                    mt-2 text-xs font-medium text-center whitespace-nowrap hidden sm:block
                    ${
                      isCurrent
                        ? "text-indigo-600"
                        : isCompleted
                        ? "text-indigo-400"
                        : "text-gray-400"
                    }
                  `}
                >
                  {labels[index]}
                </span>
              </div>

              {/* コネクターライン（最後のステップ以外） */}
              {stepNumber < totalSteps && (
                <div
                  className={`
                    flex-1 h-1 mx-2 rounded-full transition-all duration-300
                    ${isCompleted ? "bg-indigo-600" : "bg-gray-100"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* モバイル用現在のステップ表示 */}
      <div className="mt-3 text-center sm:hidden">
        <span className="text-sm font-medium text-indigo-600">
          ステップ {currentStep}/{totalSteps}: {labels[currentStep - 1]}
        </span>
      </div>
    </div>
  );
}
