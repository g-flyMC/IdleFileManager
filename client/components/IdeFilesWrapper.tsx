import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/elements/button/index';
import { ServerContext } from '@/state/server';

export default () => {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    return (
        <NavLink to={`/server/${id}/ide`}>
            <Button.Text>
                <svg
                    xmlns='http://www.w3.org/2000/svg'
                    style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.25rem' }}
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                >
                    <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'
                    />
                </svg>
                Open IDE
            </Button.Text>
        </NavLink>
    );
};
