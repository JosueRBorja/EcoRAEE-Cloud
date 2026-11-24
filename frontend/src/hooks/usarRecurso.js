import { useCallback, useEffect, useState } from "react";
import { api } from "../servicios/api";

// Hook pequeño para pantallas que leen un recurso y lo recargan al guardar.
export default function useResource(path) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setError("");
    try {
      setData(await api(path));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, error, reload };
}
