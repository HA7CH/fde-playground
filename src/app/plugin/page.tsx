import Link from "next/link";

export default function FreightRiskPluginPage() {
  return (
    <main className="plugin-page">
      <header className="plugin-hero panel">
        <div>
          <span className="title-kicker">Phase 2 · runnable slice</span>
          <h1>货代对单/做账防错插件</h1>
          <p>
            旁路复核原型：不替换原系统、不自动提交、不自动入账、不自动放单。
            先让机器帮一线找错、找漏、找风险，人做最终确认。
          </p>
        </div>
        <div className="plugin-actions">
          <Link className="btn" href="/">
            返回摸需求
          </Link>
          <a className="btn btn-accent" href="/freight-risk-plugin/index.html" target="_blank" rel="noreferrer">
            新窗口打开
          </a>
        </div>
      </header>

      <section className="plugin-frame panel">
        <iframe
          title="货代对单/做账防错插件"
          src="/freight-risk-plugin/index.html"
          loading="eager"
        />
      </section>
    </main>
  );
}
