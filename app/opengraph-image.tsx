import { ImageResponse } from 'next/og'

export const alt = 'BeerApp - Homebrewing Recipe Builder & Calculator'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0f0f1e 0%, #16213e 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Main content */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            padding: '70px 80px',
          }}
        >
          {/* Left: Beer icon area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 260,
              height: 260,
              marginRight: 70,
              borderRadius: 32,
              background: 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05))',
              border: '1px solid rgba(245,166,35,0.2)',
            }}
          >
            {/* Beer mug - drawn with divs */}
            <div style={{ display: 'flex', position: 'relative' }}>
              {/* Mug body */}
              <div
                style={{
                  width: 100,
                  height: 120,
                  borderRadius: 12,
                  background: 'linear-gradient(180deg, #FFE082 0%, #F5A623 30%, #D4820A 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Foam */}
                <div
                  style={{
                    width: 100,
                    height: 30,
                    background: 'linear-gradient(180deg, #FFFDE7, #FFE082)',
                    borderRadius: '0 0 20px 20px',
                    display: 'flex',
                  }}
                />
                {/* Bubbles */}
                <div
                  style={{
                    position: 'absolute',
                    top: 50,
                    left: 25,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: 'rgba(255,255,255,0.25)',
                    display: 'flex',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 70,
                    left: 55,
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                  }}
                />
              </div>
              {/* Handle */}
              <div
                style={{
                  position: 'absolute',
                  right: -28,
                  top: 25,
                  width: 28,
                  height: 60,
                  borderRadius: '0 16px 16px 0',
                  border: '6px solid #D4820A',
                  borderLeft: 'none',
                  display: 'flex',
                }}
              />
            </div>
          </div>

          {/* Right: Text content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#F5A623',
                lineHeight: 1,
                marginBottom: 16,
                display: 'flex',
              }}
            >
              BeerApp
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: 30,
                color: '#94a3b8',
                marginBottom: 48,
                display: 'flex',
              }}
            >
              Homebrewing Recipe Builder
            </div>

            {/* Feature pills */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  padding: '10px 22px',
                  borderRadius: 100,
                  background: 'rgba(245,166,35,0.1)',
                  border: '1px solid rgba(245,166,35,0.25)',
                  color: '#F5A623',
                  fontSize: 18,
                  fontWeight: 500,
                  display: 'flex',
                }}
              >
                ABV
              </div>
              <div
                style={{
                  padding: '10px 22px',
                  borderRadius: 100,
                  background: 'rgba(245,166,35,0.1)',
                  border: '1px solid rgba(245,166,35,0.25)',
                  color: '#F5A623',
                  fontSize: 18,
                  fontWeight: 500,
                  display: 'flex',
                }}
              >
                IBU
              </div>
              <div
                style={{
                  padding: '10px 22px',
                  borderRadius: 100,
                  background: 'rgba(245,166,35,0.1)',
                  border: '1px solid rgba(245,166,35,0.25)',
                  color: '#F5A623',
                  fontSize: 18,
                  fontWeight: 500,
                  display: 'flex',
                }}
              >
                SRM
              </div>
              <div
                style={{
                  padding: '10px 22px',
                  borderRadius: 100,
                  background: 'rgba(245,166,35,0.1)',
                  border: '1px solid rgba(245,166,35,0.25)',
                  color: '#F5A623',
                  fontSize: 18,
                  fontWeight: 500,
                  display: 'flex',
                }}
              >
                Water Chemistry
              </div>
              <div
                style={{
                  padding: '10px 22px',
                  borderRadius: 100,
                  background: 'rgba(245,166,35,0.1)',
                  border: '1px solid rgba(245,166,35,0.25)',
                  color: '#F5A623',
                  fontSize: 18,
                  fontWeight: 500,
                  display: 'flex',
                }}
              >
                Mash pH
              </div>
            </div>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 200,
            width: 800,
            height: 5,
            background: 'linear-gradient(90deg, transparent, #F5A623, transparent)',
            display: 'flex',
          }}
        />

        {/* Watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 40,
            fontSize: 18,
            color: 'rgba(148,163,184,0.4)',
            display: 'flex',
          }}
        >
          brewing.it.com
        </div>
      </div>
    ),
    { ...size },
  )
}
