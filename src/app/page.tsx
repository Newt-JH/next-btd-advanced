'use client';
import Game from '../components/Game';

export default function Page() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div style={{ width: 'min(1100px, 100%)' }}>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22, letterSpacing: 0.2 }}>
          Balloon TD
        </h1>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 13 }}>
                  클릭으로 타워 설치. <br />
                  타워 선택 시 업그레이드/판매 가능. <br />라운드 시작으로 웨이브 진행.
        </p>
        <Game />
      </div>
    </div>
  );
}
