import type { HikrobotCamera } from './hikrobotCameraAgent';
import type { SelectedCamera } from './buffingTypes';
import type { TranslationKey } from '../../i18n/LanguageContext';

type BuffingCameraPickerModalProps = {
  language: string;
  translate: (key: TranslationKey) => string;
  cameraConnecting: boolean;
  waitingPermissionMessage: string;
  mvsCameras: HikrobotCamera[];
  cameras: MediaDeviceInfo[];
  selectedCamera: SelectedCamera | null;
  mvsAgentError: string | null;
  error: string | null;
  onClose: () => void;
  onConnectMvs: (camera: HikrobotCamera) => void;
  onConnectBrowser: (cameraId: string) => void;
};

/** Render the camera-source selection dialog for browser and MVS devices. */
export function BuffingCameraPickerModal({
  language,
  translate,
  cameraConnecting,
  waitingPermissionMessage,
  mvsCameras,
  cameras,
  selectedCamera,
  mvsAgentError,
  error,
  onClose,
  onConnectMvs,
  onConnectBrowser,
}: BuffingCameraPickerModalProps) {
  return (
    <div
      className="buffing-mes__camera-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={translate('camera')}
      onClick={() => !cameraConnecting && onClose()}
    >
      <div className="buffing-mes__camera-modal" onClick={(event) => event.stopPropagation()}>
        <header className="buffing-mes__camera-modal-header">
          <h2>Camera</h2>
          <button
            type="button"
            className="buffing-mes__camera-modal-close"
            aria-label={translate('cancel')}
            onClick={onClose}
            disabled={cameraConnecting}
          >
            ×
          </button>
        </header>
        <div className="buffing-mes__camera-modal-body">
          {cameraConnecting ? (
            <div className="buffing-mes__camera-modal-loading">
              <span className="buffing-mes__camera-modal-spinner" aria-hidden="true" />
              {waitingPermissionMessage}
            </div>
          ) : (
            <>
              <section className="buffing-mes__camera-source">
                <div className="buffing-mes__camera-source-heading">
                  <h3>
                    {language === 'vi'
                      ? 'Camera công nghiệp · MVS / Hikrobot'
                      : 'Industrial camera · MVS / Hikrobot'}
                  </h3>
                  <span>{mvsCameras.length}</span>
                </div>
                {mvsCameras.length > 0 && (
                  <div className="buffing-mes__camera-list">
                    {mvsCameras.map((camera) => {
                      const selected =
                        selectedCamera?.source === 'mvs' && camera.id === selectedCamera.id;
                      return (
                        <button
                          key={camera.id}
                          type="button"
                          className={`buffing-mes__camera-option ${selected ? 'is-selected' : ''}`}
                          onClick={() => onConnectMvs(camera)}
                        >
                          <span className="buffing-mes__camera-option-main">
                            <span className="buffing-mes__camera-option-name">{camera.label}</span>
                            <small>{camera.transport}</small>
                          </span>
                          {selected ? (
                            <span className="buffing-mes__camera-option-status">
                              <i aria-hidden="true" />
                              {language === 'vi' ? 'Đã kết nối' : 'Connected'}
                            </span>
                          ) : (
                            <span className="buffing-mes__camera-option-arrow" aria-hidden="true">
                              ›
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {mvsCameras.length === 0 && (
                  <p className="buffing-mes__camera-empty">
                    {mvsAgentError || 'No MVS industrial camera was found on this workstation.'}
                  </p>
                )}
              </section>
              {cameras.length > 0 && (
                <section className="buffing-mes__camera-source">
                  <div className="buffing-mes__camera-source-heading">
                    <h3>
                      {language === 'vi' ? 'Webcam trình duyệt / USB' : 'Browser / USB webcam'}
                    </h3>
                    <span>{cameras.length}</span>
                  </div>
                  <div className="buffing-mes__camera-list">
                    {cameras.map((camera, index) => {
                      const selected =
                        selectedCamera?.source === 'browser' &&
                        camera.deviceId === selectedCamera.id;
                      return (
                        <button
                          key={camera.deviceId}
                          type="button"
                          className={`buffing-mes__camera-option ${selected ? 'is-selected' : ''}`}
                          onClick={() => onConnectBrowser(camera.deviceId)}
                        >
                          <span className="buffing-mes__camera-option-main">
                            <span className="buffing-mes__camera-option-name">
                              {camera.label || `${translate('camera')} ${index + 1}`}
                            </span>
                            <small>Browser</small>
                          </span>
                          {selected ? (
                            <span className="buffing-mes__camera-option-status">
                              <i aria-hidden="true" />
                              {language === 'vi' ? 'Đã kết nối' : 'Connected'}
                            </span>
                          ) : (
                            <span className="buffing-mes__camera-option-arrow" aria-hidden="true">
                              ›
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {cameras.length === 0 && mvsCameras.length === 0 && (
                <p className="buffing-mes__camera-error">
                  {error || translate('cameraUnavailable')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
