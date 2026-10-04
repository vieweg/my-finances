import { EventSubscriber, EntitySubscriberInterface, SoftRemoveEvent } from 'typeorm';
import { User } from '../../users/models/user.model';
import { Session } from '../models/session.model';

@EventSubscriber()
export class UserSessionSubscriber implements EntitySubscriberInterface<User> {
  listenTo() {
    return User;
  }

  async beforeSoftRemove(event: SoftRemoveEvent<User>) {
    if (event.entityId) {
      await event.manager.getRepository(Session).delete({ user: { id: event.entityId } });
    }
  }
}
