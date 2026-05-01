import React, { useEffect } from "react";

export function QuestionPage({ onGoToQuestion }) {
	useEffect(() => {
		onGoToQuestion?.("P8_Quant");
	}, [onGoToQuestion]);

	return null;
}
