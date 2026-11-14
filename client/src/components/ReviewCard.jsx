import Icon from './Icon.jsx';
import { Button, Card } from './ui.jsx';

/** Renders a coach review (daily or weekly) in the agreed 4-part format. */
export default function ReviewCard({ review, onGenerate, busy, title = 'Coach review', emptyText }) {
  const c = review?.content;
  return (
    <Card
      title={title}
      className="review"
      action={
        onGenerate && (
          <Button variant="ghost" size="sm" icon="spark" onClick={onGenerate} busy={busy}>
            {review ? 'Refresh' : 'Get review'}
          </Button>
        )
      }
    >
      {!c ? (
        <p className="muted">{emptyText ?? 'Log your day, then ask your coach for feedback.'}</p>
      ) : (
        <div className="review-body">
          {c.alerts?.map((a) => (
            <div key={a} className="alert alert-danger" role="alert">
              <Icon name="alert" />
              <span>{a}</span>
            </div>
          ))}
          <p className="review-headline">{c.headline}</p>
          <ul className="review-list">
            {c.feedback.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {c.adjustments?.length > 0 && (
            <>
              <h3 className="review-sub">Plan changes</h3>
              <ul className="review-list">
                {c.adjustments.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          {c.fixes.length > 0 && (
            <>
              <h3 className="review-sub">Fix next</h3>
              <ul className="review-list fixes">
                {c.fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          {c.tomorrow && (
            <div className="review-tomorrow">
              <span className="muted">Tomorrow</span>
              <strong>{c.tomorrow.session}</strong>
              <span>{c.tomorrow.focus}</span>
            </div>
          )}
          <p className="review-motivation">“{c.motivation}”</p>
          <p className="review-meta">
            {review.source === 'ai' ? 'AI coach' : 'Rule-based coach'} · updated{' '}
            {new Date(review.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </Card>
  );
}
