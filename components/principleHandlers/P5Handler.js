import React, { useEffect } from "react";

export function QuestionPage({ onGoToQuestion }) {
  useEffect(() => {
    onGoToQuestion?.("P5_Quant");
  }, [onGoToQuestion]);

  return null;
}
