import Link from "next/link";
import { PERSONA_ORDER, PERSONAS } from "@/lib/personas";

export default function Home() {
  return (
    <main className="landing">
      <div className="card">
        <p className="kicker">HATCH · FDE 实战擂台</p>
        <h1 className="title">货代驻场：你来当那个 FDE</h1>
        <p className="lead">
          一家叫 WAYBOUND 的货代公司一团乱。老板请你来「捋一捋」。
          你要在微信工作群里跟 4 个同事打交道，从一堆相互矛盾、各说各话的信息里，
          摸清这家公司到底卡在哪——然后自己搭一个能跑的切片。
        </p>
        <div className="brief">
          【群公告】WAYBOUND 货代 · 跟单系统需求群。这边是李总(老板)、阿强(主管)、小敏(业务员)、跟单的婷婷。<br />
          【老板】我长话短说：一票货从订舱到放单乱成一团，你先摸清楚，回头给我个能落地的方案。具体的别问我，问他们仨。
        </div>
        <div className="roles">
          {PERSONA_ORDER.map((id) => (
            <span className="role-chip" key={id}>
              <span className="role-dot" style={{ background: PERSONAS[id].color }} />
              {PERSONAS[id].name}
            </span>
          ))}
        </div>
        <Link href="/play" className="cta">
          ▶ 进办公室开始摸需求
        </Link>
        <p className="foot">提示：每个人只知道自己那摊事，没人知道全部真相。问对人、问对问题。</p>
      </div>
    </main>
  );
}
