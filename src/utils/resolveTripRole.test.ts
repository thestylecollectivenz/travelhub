import { resolveTripRoleForUser } from './resolveTripRole';
import type { TripAuthorIdentity } from '../services/TripMembersService';
import type { TripMember } from '../models/TripMember';

function mockSvc(isAuthor: boolean): { isCurrentUserTripAuthor: (author: TripAuthorIdentity) => boolean } {
  return { isCurrentUserTripAuthor: () => isAuthor };
}

describe('resolveTripRoleForUser', () => {
  const author: TripAuthorIdentity = { authorId: 1, email: 'owner@example.com' };

  it('trip author is always Editor even when not in TripMembers', () => {
    const members: TripMember[] = [
      {
        id: '1',
        tripId: 't1',
        userId: '',
        userEmail: 'companion@example.com',
        userDisplayName: 'Companion',
        role: 'Companion',
        invitedBy: '',
        invitedAt: ''
      }
    ];
    expect(resolveTripRoleForUser(mockSvc(true), 'owner@example.com', members, author)).toBe('Editor');
  });

  it('non-author with members list defaults to Follower', () => {
    const members: TripMember[] = [
      {
        id: '1',
        tripId: 't1',
        userId: '',
        userEmail: 'companion@example.com',
        userDisplayName: 'Companion',
        role: 'Companion',
        invitedBy: '',
        invitedAt: ''
      }
    ];
    expect(resolveTripRoleForUser(mockSvc(false), 'stranger@example.com', members, author)).toBe('Follower');
  });

  it('companion in TripMembers gets Companion role', () => {
    const members: TripMember[] = [
      {
        id: '1',
        tripId: 't1',
        userId: '',
        userEmail: 'markus@example.com',
        userDisplayName: 'Markus',
        role: 'Companion',
        invitedBy: '',
        invitedAt: ''
      }
    ];
    expect(resolveTripRoleForUser(mockSvc(false), 'markus@example.com', members, author)).toBe('Companion');
  });
});
