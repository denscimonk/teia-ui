import { useState, useMemo, useEffect } from 'react'
import get from 'lodash/get'
import { Loading } from '@atoms/loading'
import { Page } from '@atoms/layout'
import { useParams, useSearchParams, Outlet } from 'react-router-dom'
import useSWR from 'swr'
import { getUser } from '@data/api'
import { GetUserMetadata } from '@data/api'
import useSettings from '@hooks/use-settings'
import { validateAddress, ValidationResult } from '@taquito/utils'
import Profile from './profile'
import styles from '@style'
import { Tabs } from '@atoms/tab'
import Button from '@atoms/button/Button'

async function fetchUserInfo(addressOrSubjkt, type = 'user_address') {
  let holder = await getUser(addressOrSubjkt, type)
  if (!holder && type !== 'user_address') {
    throw new Error(`SUBJKT ${addressOrSubjkt} is not registered`, {
      cause: 'User not found',
    })
  } else if (
    !holder &&
    validateAddress(addressOrSubjkt) === ValidationResult.VALID
  ) {
    holder = {
      user_address: addressOrSubjkt,
    }
  }

  if (!holder?.user_address) {
    throw new Error(`Invalid or missing Tz address: ${addressOrSubjkt}`, {
      cause: 'Address not found',
    })
  }

  const userMetadata = (await GetUserMetadata(holder.user_address)).data
  const user = userMetadata ? { ...userMetadata } : {}

  user.address = holder.user_address

  if (get(holder, 'metadata.data.description')) {
    user.description = get(holder, 'metadata.data.description')
  }

  if (get(holder, 'metadata.data.identicon')) {
    user.identicon = get(holder, 'metadata.data.identicon')
  }

  if (holder.name) {
    user.subjkt = holder.name
  }

  return user
}

export default function Display() {
  const { address, id: subjkt } = useParams()
  const { walletBlockMap } = useSettings()

  const [showRestricted, setShowRestricted] = useState()

  let [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('show') === 'true') {
      setShowRestricted(true)
    } else {
      setShowRestricted(false)
    }
  }, [searchParams])

  // TODO (mel): properly remove all this once migrated to the filter panel.
  const [showFilters /*setShowFilters*/] = useState(false)
  const { data: user, error } = useSWR(
    ['/user', address || subjkt],
    (_, addressOrSubject) =>
      fetchUserInfo(addressOrSubject, address ? 'user_address' : 'name'),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  )

  const isRestrictedUser = useMemo(() => {
    if (!user?.address) return false
    return walletBlockMap.get(user.address) === 1
  }, [user?.address, walletBlockMap])

  if (error) {
    // return <ErrorComponent title="Route Error" message={error.message} />
    throw error
  }

  if (!user) {
    return (
      <Page title="loading">
        <Loading message="Getting user profile" />
      </Page>
    )
  }

  const TABS = [
    { title: 'Creations', to: '' },
    { title: 'Collection', to: 'collection' },
    { title: 'Collabs', to: 'collabs' },
  ]

  return (
    <Page feed title={user.alias}>
      <Profile user={user} />
      {user.address.substr(0, 2) !== 'KT' && (
        <div className={styles.menu}>
          {/* <Tab selected={here[here.length - 1] === ''} to={''}>
        Creations
      </Tab>
      <Tab selected={here.slice(2) === 'collection'} to={`collection`}>
        Collection
      </Tab>
      <Tab selected={here.slice(2) === 'collabs'} to={`collabs`}>
        Collabs
      </Tab> */}
          <Tabs tabs={TABS} />

          {/* <div className={styles.filter}>
          <Button
            onClick={() => {
              setShowFilters(!showFilters)
            }}
          >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="feather feather-filter"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
          </Button>
        </div> */}
        </div>
      )}
      {isRestrictedUser && (
        <div className={styles.restricted}>
          <h1>Restricted account {showRestricted ? '(bypassed)' : ''}</h1>
          <p>
            {' '}
            Contact the Teia moderators on{' '}
            <Button href="https://discord.gg/TKeybhYhNe">Discord</Button> to
            resolve the status.
          </p>
          <p>
            {' '}
            See the{' '}
            <Button href="https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#3-terms-and-conditions---account-restrictions">
              Teia Terms and Conditions
            </Button>
          </p>
        </div>
      )}

      <Outlet
        context={{ showRestricted, showFilters, address: user.address }}
      />
    </Page>
  )
}
