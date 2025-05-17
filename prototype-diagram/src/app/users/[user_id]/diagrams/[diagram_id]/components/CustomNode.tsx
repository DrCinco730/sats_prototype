import React from "react";

export default function CustomNode() {
  return (
    <div className="uml-class-node">
      <div className="uml-class-name">ClassName</div>
      <div className="uml-class-section">
        <div className="uml-class-attributes">
          <div>attribute1</div>
          <div>attribute2</div>
        </div>
      </div>
      <div className="uml-class-section">
        <div className="uml-class-methods">
          <div>method1</div>
          <div>method2</div>
        </div>
      </div>
    </div>
  );
}
