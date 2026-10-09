import React from 'react';

interface ThreeDLoaderProps {
  label?: string;
}

export const ThreeDLoader: React.FC<ThreeDLoaderProps> = ({
  label = 'Verifying Access Security...'
}) => (
  <div className="dn-loader-shell" role="status" aria-live="polite" aria-label={label}>
    <div className="dn-loader-scene" aria-hidden="true">
      <div className="dn-loader-orbit dn-loader-orbit-one" />
      <div className="dn-loader-orbit dn-loader-orbit-two" />
      <div className="dn-loader-cube">
        <span className="dn-loader-face dn-loader-face-front" />
        <span className="dn-loader-face dn-loader-face-back" />
        <span className="dn-loader-face dn-loader-face-right" />
        <span className="dn-loader-face dn-loader-face-left" />
        <span className="dn-loader-face dn-loader-face-top" />
        <span className="dn-loader-face dn-loader-face-bottom" />
      </div>
      <div className="dn-loader-mascot" aria-hidden="true">
        <span className="dn-loader-eye dn-loader-eye-left" />
        <span className="dn-loader-eye dn-loader-eye-right" />
        <span className="dn-loader-smile" />
      </div>
    </div>
    <div className="dn-loader-brand" aria-hidden="true">
      <span className="dn-loader-logo"><span>D</span><span>N</span></span>
      <strong>DealNest</strong>
    </div>
    <p className="dn-loader-label">{label}</p>
    <div className="dn-loader-progress" aria-hidden="true">
      <span />
    </div>
  </div>
);
