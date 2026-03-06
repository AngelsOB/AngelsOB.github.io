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
          background: 'linear-gradient(145deg, #0f0f1e 0%, #1a1a2e 40%, #16213e 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow behind icon */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: -80,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Second glow bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            right: -60,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,166,35,0.06) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

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
              flexShrink: 0,
              borderRadius: 32,
              background: 'linear-gradient(135deg, rgba(245,166,35,0.15) 0%, rgba(245,166,35,0.05) 100%)',
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
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Foam */}
                <div
                  style={{
                    width: '100%',
                    height: 30,
                    background: 'linear-gradient(180deg, #FFFDE7 0%, #FFF8E1 60%, #FFE082 100%)',
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
                    borderRadius: '50%',
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
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 85,
                    left: 35,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
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
                fontWeight: 800,
                color: '#F5A623',
                lineHeight: 1,
                marginBottom: 16,
                letterSpacing: -2,
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
                fontWeight: 400,
                letterSpacing: 0.5,
              }}
            >
              Homebrewing Recipe Builder
            </div>

            {/* Feature pills */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['ABV', 'IBU', 'SRM', 'Water Chemistry', 'Mash pH'].map(
                (feature) => (
                  <div
                    key={feature}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 100,
                      background: 'rgba(245,166,35,0.1)',
                      border: '1px solid rgba(245,166,35,0.25)',
                      color: '#F5A623',
                      fontSize: 18,
                      fontWeight: 500,
                      letterSpacing: 0.5,
                    }}
                  >
                    {feature}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background:
              'linear-gradient(90deg, transparent 0%, #F5A623 20%, #F5A623 80%, transparent 100%)',
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
            fontWeight: 400,
          }}
        >
          brewing.it.com
        </div>
      </div>
    ),
    { ...size },
  )
}
