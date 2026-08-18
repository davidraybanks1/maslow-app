import styles from './AppHeader.module.css'
import BrandMark from './BrandMark'
import ProfileMenu from './ProfileMenu'

export default function AppHeader({ slot, name, email, reviewCadence, updateReviewCadence }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <BrandMark size={20} />
      </div>
      <div className={styles.right}>
        {slot}
        <ProfileMenu name={name} email={email} reviewCadence={reviewCadence} updateReviewCadence={updateReviewCadence} />
      </div>
    </header>
  )
}
