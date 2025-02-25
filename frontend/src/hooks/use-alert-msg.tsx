import { useEffect, useState } from "react";

export function useAlertMsg(closeDelay: number = 6000) {
  const [message, setMessage] = useState<string | undefined>();
  useEffect(() => {
    if (!message) return;
    setTimeout(() => {
      setMessage(undefined)
    }, closeDelay);
  }, [message, closeDelay]);
  return {
    message,
    setMessage
  };
};