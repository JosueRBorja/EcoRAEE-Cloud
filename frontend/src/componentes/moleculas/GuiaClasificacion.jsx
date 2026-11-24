import { classificationGuide } from "../../utilidades/clasificacion";
export default function ClassificationGuide() {
  return (
    <div className="classification-guide">
      {Object.entries(classificationGuide).map(([key, item]) => (
        <article
          key={key}
          className={`classification-guide--${key.toLowerCase()}`}
        >
          <span className="classification-dot" />
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}
